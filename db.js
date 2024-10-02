const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL || 'postgres://localhost/restaurant_review');
const uuid = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT = process.env.JWT || 'shhh';
const {faker, FoodModule} = require('@faker-js/faker');



const createTables = async() => {
  const SQL = `
  DROP TABLE IF EXISTS comments CASCADE;
  DROP TABLE IF EXISTS reviews CASCADE;
  DROP TABLE IF EXISTS restaurants CASCADE;
  DROP TABLE IF EXISTS category CASCADE;
  DROP TABLE IF EXISTS users CASCADE;

  CREATE TABLE users(
    image VARCHAR(255),
    id UUID PRIMARY KEY NOT NULL,
    name VARCHAR(55),
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(100) DEFAULT 'user'
  );
  CREATE TABLE category(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(55) NOT NULL UNIQUE
  );
  CREATE TABLE restaurants(
    image VARCHAR(255),
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(55) NOT NULL,
    category VARCHAR(255) REFERENCES category(name) ON DELETE SET NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    open_time INTEGER NOT NULL,
    closing_time INTEGER NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE RESTRICT
  );
  CREATE TABLE reviews(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL,
    text VARCHAR(255) NOT NULL,
    owner_id UUID
  );
  CREATE TABLE comments(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    text VARCHAR(255) NOT NULL
  );

  CREATE OR REPLACE FUNCTION set_owner_id()
  RETURNS TRIGGER AS $$
  BEGIN
    SELECT owner_id INTO NEW.owner_id FROM restaurants WHERE id = NEW.restaurant_id;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER set_owner_id_trigger
  BEFORE INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION set_owner_id();

  CREATE OR REPLACE FUNCTION update_reviews_owner_id()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE reviews
    SET owner_id = NEW.owner_id
    WHERE restaurant_id = NEW.id;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER update_reviews_on_restaurant_update
  AFTER UPDATE OF owner_id ON restaurants
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION update_reviews_owner_id();
  `
  await client.query(SQL);
};
createTables();

//users table functions
//create, fetch, delete, post
const createAccount = async ({ username, password}) => {
  const hashedPassword= await bcrypt.hash(password, 5);
  const SQL = `
  INSERT INTO users(id, username, password) VALUES($1, $2, $3) 
  RETURNING *
  `;
  const response = await client.query(SQL, [uuid.v4(), username, hashedPassword]);
  return response.rows[0];
};


const createUser = async ({image, name, username, password}) => {
  const hashedPassword = await bcrypt.hash(password, 5);
  const SQL = `
  INSERT INTO users(image, id, name, username, password) VALUES($1, $2, $3, $4, $5) 
  RETURNING *
  `;
  const response = await client.query(SQL, [image, uuid.v4(), name, username, hashedPassword]);
  return response.rows[0];
};

const fetchAllUsers = async() => {
  const SQL = `
  SELECT * FROM users
  `;
  const response = await client.query(SQL);
  return response.rows
};

const fetchSingleUser = async(id) => {
  const SQL = `
  SELECT * FROM users
  WHERE id = $1
  `;
  const response = await client.query(SQL, [id]);
  return response.rows[0]
};

//for login
const fetchUserWithUsername = async(username) => {
  const SQL = `
  SELECT * FROM users
  WHERE username = $1
  `;
  const response = await client.query(SQL, [username]);
  return response.rows[0]
};

const destroyUser = async (id) => {
  const SQL = `
  DELETE FROM users
  WHERE id = $1
  RETURNING *
  `;
  const response = await client.query(SQL, [id]);
  return response.rows[0];
};

//assign role to user
const assignRole = async({role, id}) => {
let updates = [];
let values = [];

if(role !== undefined){
  updates.push(`role = $${updates.length + 1}`);
  values.push(role);
}

values.push(id);

if(updates.length === 0){
  throw new Error('No fields to update');
}

 const SQL = `
 UPDATE users
 SET ${updates.join(', ')}
 WHERE id = $${values.length}
 RETURNING *
 `; 
 const response = await client.query(SQL, values);
 return response.rows[0]
};

const checkIfOwnerOfRestaurant = async(restaurant_id, user_id) => {
  const SQL = `
  SELECT * FROM restaurants 
  WHERE id = $1 AND owner_id = $2
  `;
  const response = await client.query(SQL, [restaurant_id, user_id]);
  return response.rows.length > 0;
};

//update user image and name
const updateUserInfo = async({image, name, id}) => {
  let updates = [];
  let values = [];

  if(image != undefined){
    updates.push(`image = $${updates.length + 1}`);
    values.push(image);
  }

  if(name !== undefined){
    updates.push(`name = $${updates.length + 1}`);
    values.push(name);
  }

  values.push(id);

  if(updates.length === 0){
    throw new Error('No fields to update');
  }
  
  const SQL=`
  UPDATE users
  SET ${updates.join(', ')}
  WHERE id = $${values.length}
  RETURNING *;
  `;
  const response = await client.query(SQL, values);
  return response.rows[0]
};


//category table functions
const createCategory = async (name) => {
  const SQL = `
  INSERT INTO category(name) VALUES($1) 
  RETURNING *
  `;
  const response = await client.query(SQL, [name]);
  return response.rows[0];
};

const fetchAllCategories = async() => {
  const SQL = `
  SELECT * FROM category
  `;
  const response =await client.query(SQL);
  return response.rows
};

const destroyCategory = async(id) => {
  const SQL = `
  DELETE FROM category
  WHERE id = $1
  RETURNING name
  `;
  const response = await client.query(SQL, [id]);
  return response.rows[0]
};

const createRestaurant = async({image, name, category, phone, address, open_time, closing_time, owner_id}) => {
  const SQL = `
  INSERT INTO restaurants(image, name, category, phone, address, open_time, closing_time, owner_id) VALUES($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
  `;
  const response = await client.query(SQL, [image, name, category, phone, address, open_time, closing_time, owner_id]);
  return response.rows[0];
};

const fetchAllRestaurants = async() => {
  const SQL = `
  SELECT * FROM restaurants
  `;
  const response = await client.query(SQL);
  return response.rows
};

//fetch restaurant(s) of owner to manage
const fetchOwnerRestaurant = async(owner_id) => {
  const SQL = `
  SELECT * FROM restaurants
  WHERE owner_id = $1
  `;
  const response = await client.query(SQL, [owner_id]);
  return response.rows
};

const destroyRestaurant = async(id) => {
  const SQL = `
  DELETE  FROM restaurants
  WHERE id = $1
  RETURNING name
  `;
  const response = await client.query(SQL, [id]);
  return response.rows[0]
};

//update restaurant
const updateRestaurant = async({image, name, category, phone, address, open_time, closing_time, restaurant_id}) => {
  let updates = [];
  let values = [];

  if(image != undefined){
    updates.push(`image = $${updates.length + 1}`);
    values.push(image);
  }

  if(name != undefined){
    updates.push(`name = $${updates.length + 1}`);
    values.push(name);
  }

  if(category != undefined){
    updates.push(`category = $${updates.length + 1}`);
    values.push(category);
  }

  if(phone != undefined){
    updates.push(`phone = $${updates.length +1}`);
    values.push(phone);
  }

  if(address != undefined){
    updates.push(`address = $${updates.length +1}`);
    values.push(address);
  }

  if(open_time != undefined){
    updates.push(`open_time = $${updates.length + 1}`);
    values.push(open_time);
  }

  if(closing_time != undefined){
    updates.push(`closing_time = $${updates.length + 1}`);
    values.push(closing_time);
  }

  values.push(restaurant_id);

  if(updates.length === 0){
    throw new Error('No fields to update');
  }

  const SQL = `
  UPDATE restaurants
  SET ${updates.join(', ')}
  WHERE id = $${values.length} 
  RETURNING *;
  `;
  const response = await client.query(SQL, values);
  return response.rows[0]
};

//assign owner
const assignOwner = async({owner_id, restaurant_id}) => {
try{  
  await client.query('BEGIN');

let restaurantUpdates = [];
let restaurantValues = [];
let userUpdates = [];
let userValues = [];

if(owner_id !== undefined){
  restaurantUpdates.push(`owner_id = $${restaurantUpdates.length + 1}`);
  restaurantValues.push(owner_id);
}

if(restaurant_id !== undefined){
  restaurantValues.push(restaurant_id);
}

let restaurantResponse = null;
if(restaurantUpdates.length > 0){
  const restaurantSQL = `
  UPDATE restaurants
  SET ${restaurantUpdates.join(', ')}
  WHERE id = $${restaurantValues.length}
  RETURNING *;
  `;
  restaurantResponse = await client.query(restaurantSQL, restaurantValues);
}

let userResponse = null;
if(owner_id !== undefined){
  userUpdates.push(`role = 'owner'`);
  userValues.push(owner_id);
}
  
  const userSQL = `
  UPDATE users
  SET ${userUpdates.join(', ')}
  WHERE id = $1
  RETURNING *;
  `;
  userResponse = await client.query(userSQL, userValues);
  
  await client.query('COMMIT');

  return{
    restaurant: restaurantResponse ? restaurantResponse.rows: null,
    owner: userResponse ? userResponse.rows: null
  };

}catch(error){
  await client.query('ROLLBACK');
  throw error;
  }
};

//review table functions
const createReview = async ({restaurant_id, user_id, rating, text}) => {
  const SQL = `
  INSERT INTO reviews(restaurant_id, user_id, rating, text) VALUES($1, $2, $3, $4)
  RETURNING *
  `;
  const response = await client.query(SQL, [restaurant_id, user_id, rating, text]);
  return response.rows[0];
};

//fetch all reviews
const fetchAllReviews = async() => {
  const SQL = `
  SELECT * FROM reviews
  `;
  const response = await client.query(SQL);
  return response.rows
};

//fetch reviews of a restaurant
const fetchRestaurantReviews = async(restaurant_id) => {
  const SQL = `
  SELECT * FROM reviews
  Where restaurant_id = $1
  `;
  const response = await client.query(SQL, [restaurant_id]);
  return response.rows
};

//fetch reviews of an user
const fetchUserReviews = async(user_id) => {
  const SQL = `
  SELECT * FROM reviews
  WHERE user_id = $1
  `;
  const response = await client.query(SQL, [user_id]);
  return response.rows
};

//to check if user owns the review
const fetchReviewById = async(review_id) => {
  try{
    const SQL = `
    SELECT *
    FROM reviews
    WHERE id = $1
    `;
    const response = await client.query(SQL, [review_id]);
    if(response.rows.length === 0){
      return null
    }
    return response.rows[0];
  }catch(error){
    console.error('Error fetching review:', error);
    throw error;
  }
};

const updateReview = async({rating, text, review_id, user_id}) => {
  let updates = [];
  let values = [];

  if(rating != undefined){
    updates.push(`rating = $${updates.length + 1}`);
    values.push(rating);
  }

  if(text != undefined){
    updates.push(`text = $${updates.length + 1}`);
    values.push(text);
  }
  
  values.push(review_id, user_id);

  if(updates.length === 0){
    throw new Error('No fields to update');
  }

  const SQL = `
  UPDATE reviews
  SET ${updates.join(', ')}
  WHERE id = $${values.length - 1} AND user_id = $${values.length}
  RETURNING *;
  `;
  const response = await client.query(SQL, values);
  return response.rows[0]
};

const destroyReview = async(id) => {
  const SQL = `
  DELETE FROM reviews
  WHERE id = $1
  RETURNING *
  `;
  const response = await client.query(SQL, [id]);
  return response.rows[0]
};

const destroyReviewByUser = async({review_id, user_id}) => {
  const SQL = `
  DELETE FROM reviews
  WHERE id = $1 AND user_id = $2
  RETURNING *
  `;
  const response = await client.query(SQL, [review_id, user_id]);
  return response.rows[0]
};

//comment table functions
const createComment = async ({review_id, user_id, text}) => {
  const SQL = `
  INSERT INTO comments(review_id, user_id, text) VALUES($1, $2, $3)
  RETURNING *
  `;
  const response = await client.query(SQL, [review_id, user_id, text]);
  return response.rows[0];
};

//fetch comments that belong to the review
const fetchReviewComments = async(review_id) => {
  const SQL = `
  SELECT * FROM comments
  WHERE review_id = $1
  `;
  const response = await client.query(SQL, [review_id])
  return response.rows
};

//for the purpose to check if the user owns the comment
const fetchCommentById = async(comment_id) => {
  try{
    const SQL = `
    SELECT *
    FROM comments
    WHERE id = $1
    `;
    const response = await client.query(SQL, [comment_id]);
    if(response.rows.length === 0){
      return null;
    }
    return response.rows[0];
  }catch(error){
    console.log('Error fetching review', error);
    throw error;
  }
};

//fetchAllComments
const fetchAllComments = async() => {
  const SQL = `
  SELECT * FROM comments
  `;
  const response = await client.query(SQL);
  return response.rows
};

const destroyCommentFromUser = async({comment_id, user_id}) => {
  const SQL = `
  DELETE FROM comments
  WHERE id = $1 AND user_id = $2
  RETURNING *
  `;
  const response = await client.query(SQL, [comment_id, user_id]);
  return response.rows[0]
};

const destroyComment = async(id) => {
  const SQL = `
  DELETE FROM comments
  WHERE id = $1
  RETURNING *
  `;
  const response = await client.query(SQL, [id]);
  return response.rows[0]
};

const updateComment = async({text, comment_id, user_id}) => {
  let updates = [];
  let values = [];

  if(text != undefined){
    updates.push(`text = $${updates.length + 1}`);
    values.push(text);
  }
  
values.push(comment_id, user_id);

if(updates.length === 0){
  throw new Error('No fields to update');
}

  const SQL = `
  UPDATE comments
  SET ${updates.join(', ')}
  WHERE id = $${values.length - 1} AND user_id = $${values.length}
  RETURNING *;
  `;
  const response = await client.query(SQL, values);
  return response.rows[0]
};

//create all table datas
const createDatas = async () => {
// console.log(newAccount);
  const userData = await Promise.all([
    createUser({image: faker.image.avatar(), id: uuid.v4(), name: 'Tony Stark', username: 'ironman000', password: 'arkreactor'}),
    createUser({image: faker.image.avatar(), id: uuid.v4(), name: 'Wanda Maximoff', username: 'scarletwitch111', password: 'thedarkhold'}),
    createUser({image: faker.image.avatar(), id: uuid.v4(), name: 'Steven Strange', username: 'drstrange222', password: 'timestone'}),
    createUser({image: faker.image.avatar(), id: uuid.v4(), name: 'Peter Parker', username: 'spidey333', password: 'web'}),
    createUser({image: faker.image.avatar(), id: uuid.v4(), name: 'Natasha Romanoff', username: 'blackwidow444', password: 'spy'})
]);
console.log("users: ", userData);

  const roleData = await Promise.all([
    assignRole({role:'admin', id: userData[0].id})
  ]);
console.log("updating role:", roleData)

  const categoryData = await Promise.all([createCategory('Chinese'), createCategory('Japanese'), createCategory('Mexican'), createCategory('Family')]);

  const restaurantData = [];
  for(let i = 0; i < 30; i++){
    let newRestaurant = {
      image: faker.image.urlLoremFlickr({category: 'restaurant'}),
      name: faker.company.name(),
      category: categoryData[Math.floor(Math.random() * (categoryData.length-1))].name ,
      phone: faker.phone.number({style: 'national'}),
      address: faker.location.streetAddress({useFullAddress: true}),
      open_time: faker.number.int({min: 8, max: 12}),
      closing_time: faker.number.int({min: 6, max: 11 })
    }
    // console.log(newRestaurant, i);
    restaurantData.push(await createRestaurant(newRestaurant))
  };
  console.log(restaurantData);

  const reviewData = [];
  for(let i = 0; i < 50; i++){
    let newReview = {
      restaurant_id: restaurantData[Math.floor(Math.random() * (restaurantData.length -1))].id,
      user_id: userData[Math.floor(Math.random() * (userData.length - 1))].id,
      rating: faker.number.int({min: 0, max: 5}),
      text: faker.lorem.paragraph({min:1, max: 3})
    }
    // console.log(newReview, i);
    reviewData.push(await createReview(newReview));
  }
  // console.log("review data: ", reviewData)

    //calculate review counts of an user, maybe do it in front end, or comeback and do it.
    // const reviewCountCalc = () => {
    //   let count = 0;
    //   for(let i = 0; i < reviewData.length; i++){
    //     if(reviewData[i].id === users.Data[i].review_id){
    //       count++
    //     }
    //     return count
    //   }
    //   usersData.reviewCount.push(count)
    // } 

  const commentData = [];
  for(let i = 0; i < 30; i++){
    let newComment = {
      review_id: reviewData[Math.floor(Math.random() * (reviewData.length -1))].id,
      user_id: userData[Math.floor(Math.random() * (userData.length -1))].id,
      text: faker.lorem.paragraph({min: 1, max: 2})
    }
    // console.log(newComment, i);
    commentData.push(await createComment(newComment));
  }
  // console.log("comment data: ", commentData, );
};
createDatas();




module.exports = {client, createTables, createAccount, createUser, createCategory, createRestaurant, createReview, createComment, fetchUserWithUsername, fetchAllUsers, fetchAllCategories, fetchAllRestaurants, fetchRestaurantReviews, fetchSingleUser, fetchOwnerRestaurant, fetchUserReviews, fetchReviewComments, destroyCategory, destroyUser, destroyRestaurant, destroyReview, destroyReviewByUser, destroyCommentFromUser, updateUserInfo, updateRestaurant, updateReview, updateComment, assignOwner, fetchAllReviews, fetchAllComments, destroyComment, assignRole, fetchReviewById, fetchCommentById, checkIfOwnerOfRestaurant}