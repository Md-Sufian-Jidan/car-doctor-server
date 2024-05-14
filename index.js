const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require("dotenv").config();
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;

//middleware
// const corsOption = {
//   optionSuccessStatus: 200
// }
// app.use(cors({ corsOption }));
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
}))
app.use(express.json());
app.use(cookieParser());

///////////////
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qvjjrvn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middlewares
const logger = (req, res, next) => {
  console.log('method', req.method, 'url', req.url);
  next();
};
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log('token in the middleware', token);
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'unauthorized access' })
    }
    req.user = decoded;
    next();
  });
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");

    //auth related api
    // user login token
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '100h' });
      res.cookie('token', token, cookieOptions)
        .send({ success: true });
    });

    //user log out api token
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logging user', user);
      // maxAge = 0 means expire the token
      res.clearCookie('token', { ...cookieOptions, maxAge: 0 })
        .send({ success: true })
    })

    //services related api
    app.get('/services', async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        // Sort returned documents in ascending order by title (A->Z)
        // Include only the `title` and `imdb` fields in each returned document
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    //bookings
    app.get('/booking', logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log('token owner info', req.user);
      if (res?.user?.email !== req?.query?.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req?.query?.email };
      }
      const result = await bookingCollection.find(query).toArray();
      console.log(result);
      res.send(result)
    });

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      // console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result)
    });

    app.patch('booking/:id', async (req, res) => {
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const id = req.params.id;
      const filter = { _id: new Object(id) }
      const updatedDoc = {
        $set: {
          status: updatedBooking.status
        }
      }
      const result = await bookingCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.delete('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      // const filter = 
      const result = await bookingCollection.deleteOne(query);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
//------------------------

app.get('/', (req, res) => {
  res.send('doctor is running');
})

app.listen(port, () => {
  console.log(`car doctor running on port ${port}`);
})