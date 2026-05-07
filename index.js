const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const { MongoClient, ServerApiVersion } = require('mongodb');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const port = process.env.PORT || 3000

// Middleware to parse JSON bodies

app.use(cors())

// app.use(
//    '/webhook',
//    express.raw({ type: 'application/json' })
// );
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tav8afj.mongodb.net/?appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('lifeSpark');
    const usersCollection = db.collection('users');
    const lessonsCollection = db.collection('lessons');


// API endpoint to create a new user

    app.post('/users', async (req, res) => {
      
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.status(400).send({ 
          message: 'User already exists',
          inserted: false
         });
      }

      user.role = 'user';
      user.isPremium = false;
      user.createdAt = new Date();
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });








    // API endpoint to create a new lesson

    app.post('/lessons', async(req, res) => {

   const lesson = req.body;

   const result = await lessonsCollection.insertOne(lesson);

   res.send(result);
});

    


    // Payment related API endpoints can be added here, for example:

    app.post('/create-checkout-session', async (req, res) => {
      try {

      const paymentInfo = req.body;

      const session = await stripe.checkout.sessions.create({

         line_items: [
            {
               price_data: {

                  currency: 'bdt',

                  unit_amount: 150000,

                  product_data: {
                     name: 'Premium Subscription',
                  },
               },

               quantity: 1,
            },
         ],

         mode: 'payment',

         metadata: {
            email: paymentInfo.email,
         },

         success_url: `${process.env.SITE_DOMAIN}/payment-success`,

         cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`,
      });

      console.log(session.url);

      res.send({ url: session.url });

   } catch(error){

      console.log(error);

      res.status(500).send({
         error: error.message
      });
   }
});

app.get('/users/:email', async(req, res) => {

   const email = req.params.email;

   const query = { email };

   const user = await usersCollection.findOne(query);

   res.send(user);
});

app.patch('/users/premium/:email', async(req, res) => {

   const email = req.params.email;

   const result = await usersCollection.updateOne(
      { email },
      {
         $set: {
            isPremium: true
         }
      }
   );

   res.send(result);
});

// app.post('/webhook',async (req, res) => {

//     const sig = req.headers['stripe-signature'];

//     let event;

//     try {

//       event = stripe.webhooks.constructEvent(
//         req.body,
//         sig,
//         process.env.STRIPE_WEBHOOK_SECRET
//       );

//     } catch (err) {

//       return res.status(400).send(
//         `Webhook Error: ${err.message}`
//       );
//     }

//     // payment success
//     if (event.type === 'checkout.session.completed') {

//       const session = event.data.object;

//       const email = session.metadata.email;

//       // update premium
//       await usersCollection.updateOne(
//         { email },
//         {
//           $set: {
//             isPremium: true
//           }
//         }
//       );
//     }

//     res.send();
//   }
// );
















    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Life Spark is Running!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
