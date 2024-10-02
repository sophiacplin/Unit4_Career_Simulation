const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const {client} = require('./db');
app.use(express.json());
app.use(require('morgan')('dev'));

const userRouter = require('./routes/userRouter');
const categoryRouter = require('./routes/categoryRouter');
const restaurantRouter = require('./routes/restaurantRouter');
const reviewRouter = require('./routes/reviewRouter');
const commentRouter = require('./routes/commentRouter');

app.use('/api/users', userRouter);
app.use('/api/category', categoryRouter);
app.use('/api/restaurants', restaurantRouter);
app.use('/api/reviews', reviewRouter);
app.use('/api/comments', commentRouter);


const init = async () => {

  await client.connect();
  console.log('conncted to database');


  app.listen(PORT, () => {
    console.log('Your server is running on PORT' + PORT)
  })
}

init();