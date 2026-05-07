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

   const favoritesCollection = db.collection('favorites');

   const commentsCollection = db.collection('comments');

   const reportsCollection = db.collection('reports');


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
      // default fields
   lesson.likes = [];

   lesson.likesCount = 0;

   lesson.favoritesCount = 0;

   lesson.updatedAt = new Date();

   lesson.createdAt = new Date();


   const result = await lessonsCollection.insertOne(lesson);

   res.send(result);
});

app.get('/lessons', async(req, res) => {

   const email = req.query.email;

   const query = {
      creatorEmail: email
   };

   const result = await lessonsCollection
   .find(query)
   .toArray();

   res.send(result);
});


const { ObjectId } = require('mongodb');

app.delete('/lessons/:id', async(req, res) => {

   const id = req.params.id;

   const query = {
      _id: new ObjectId(id)
   };

   const result = await lessonsCollection.deleteOne(query);

   res.send(result);
});


    
app.patch('/lessons/:id', async(req, res) => {

   const id = req.params.id;

   const updatedLesson = req.body;

   const query = {
      _id: new ObjectId(id)
   };

   const updatedDoc = {

      $set: {

         title: updatedLesson.title,

         description: updatedLesson.description,

         category: updatedLesson.category,

         emotionalTone: updatedLesson.emotionalTone,

         image: updatedLesson.image,

         privacy: updatedLesson.privacy,

         accessLevel: updatedLesson.accessLevel,
         updatedAt: new Date()
      }
   };

   const result = await lessonsCollection.updateOne(
      query,
      updatedDoc
   );

   res.send(result);
});

app.patch('/lessons/privacy/:id', async(req, res) => {

   const id = req.params.id;

   const { privacy } = req.body;

   const result = await lessonsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
         $set: { privacy }
      }
   );

   res.send(result);
});

app.patch('/lessons/access/:id', async(req, res) => {

   const id = req.params.id;

   const { accessLevel } = req.body;

   const result = await lessonsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
         $set: { accessLevel }
      }
   );

   res.send(result);
});

app.get('/lessons/:id', async(req, res) => {

   const id = req.params.id;

   const query = {
      _id: new ObjectId(id)
   };

   const result = await lessonsCollection.findOne(query);

   res.send(result);
});




app.get('/public-lessons/:email', async(req, res) => {

   const email = req.params.email;

   const query = {

      creatorEmail: email,

      privacy: 'Public'
   };

   const result = await lessonsCollection
   .find(query)
   .sort({ createdAt: -1 })
   .toArray();

   res.send(result);
});


app.get('/public-lessons', async(req, res) => {

   const query = {
      privacy: 'Public'
   };

   const result = await lessonsCollection
   .find(query)
   .sort({ createdAt: -1 })
   .toArray();

   res.send(result);
});






// details of a public lesson for non-logged in users

app.get('/creator-lessons-count/:email', async(req, res) => {

   const email = req.params.email;

   const query = {
      creatorEmail: email
   };

   const count =
   await lessonsCollection.countDocuments(query);

   res.send({ count });
});



app.patch('/lessons/like/:id', async(req, res) => {

   const id = req.params.id;

   const { email } = req.body;

   const query = {
      _id: new ObjectId(id)
   };

   const lesson =
   await lessonsCollection.findOne(query);

   const alreadyLiked =
   lesson.likes?.includes(email);

   let updateDoc;

   if(alreadyLiked){

      updateDoc = {

         $pull: {
            likes: email
         },

         $inc: {
            likesCount: -1
         }
      };

   } else {

      updateDoc = {

         $push: {
            likes: email
         },

         $inc: {
            likesCount: 1
         }
      };
   }

   const result =
   await lessonsCollection.updateOne(
      query,
      updateDoc
   );

   res.send(result);
});


app.post('/favorites', async(req, res) => {

   const favorite = req.body;

   const query = {

      lessonId: favorite.lessonId,

      userEmail: favorite.userEmail
   };

   const alreadyExists =
   await favoritesCollection.findOne(query);

   if(alreadyExists){

      return res.send({

         inserted: false,

         message: 'Already favorited'
      });
   }

   // increase favorites count
   await lessonsCollection.updateOne(

      {
         _id: new ObjectId(
            favorite.lessonId
         )
      },

      {
         $inc: {
            favoritesCount: 1
         }
      }
   );

   const result =
   await favoritesCollection.insertOne(
      favorite
   );

   res.send(result);
});


app.patch('/favorites/:lessonId', async(req, res) => {

   const lessonId = req.params.lessonId;

   const { userEmail } = req.body;

   // already favorite?
   const existingFavorite =
   await favoritesCollection.findOne({

      lessonId,
      userEmail
   });

   // REMOVE
   if(existingFavorite){

      await favoritesCollection.deleteOne({

         _id: existingFavorite._id
      });

      await lessonsCollection.updateOne(

         {
            _id: new ObjectId(lessonId)
         },

         {
            $inc: {
               favoritesCount: -1
            }
         }
      );

      return res.send({

         favorited: false
      });
   }

   // ADD
   await favoritesCollection.insertOne({

      lessonId,
      userEmail,
      createdAt: new Date()
   });

   await lessonsCollection.updateOne(

      {
         _id: new ObjectId(lessonId)
      },

      {
         $inc: {
            favoritesCount: 1
         }
      }
   );

   res.send({

      favorited: true
   });
});




app.get('/favorites', async(req, res) => {

   const email = req.query.email;

   const query = {
      userEmail: email
   };

   const result =
   await favoritesCollection
   .find(query)
   .toArray();

   res.send(result);
});


app.delete('/favorites/:id', async(req, res) => {

   const id = req.params.id;

   const favorite =
   await favoritesCollection.findOne({

      _id: new ObjectId(id)
   });

   // decrease favorites count
   if(favorite){

      await lessonsCollection.updateOne(

         {
            _id: new ObjectId(
               favorite.lessonId
            )
         },

         {
            $inc: {
               favoritesCount: -1
            }
         }
      );
   }

   const result =
   await favoritesCollection.deleteOne({

      _id: new ObjectId(id)
   });

   res.send(result);
});



app.post('/comments', async(req, res) => {

   const comment = req.body;

   const result =
   await commentsCollection.insertOne(
      comment
   );

   res.send(result);
});


app.get('/comments/:lessonId', async(req, res) => {

   const lessonId = req.params.lessonId;

   const query = { lessonId };

   const result =
   await commentsCollection
   .find(query)
   .sort({ createdAt: -1 })
   .toArray();

   res.send(result);
});



app.post('/reports', async(req, res) => {

   const report = req.body;

   const result =
   await reportsCollection.insertOne(
      report
   );

   res.send(result);
});



app.get('/similar-lessons', async(req, res) => {

   const {
      category,
      emotionalTone
   } = req.query;

   const result =
   await lessonsCollection.find({

      privacy: 'Public',

      $or: [

         { category },

         { emotionalTone }
      ]
   })
   .limit(6)
   .toArray();

   res.send(result);
});

app.get('/similar-lessons/:id', async(req, res) => {

   const id = req.params.id;

   // current lesson
   const currentLesson =
   await lessonsCollection.findOne({

      _id: new ObjectId(id)
   });

   // related query
   const query = {

      _id: {
         $ne: new ObjectId(id)
      },

      privacy: 'Public',

      $or: [

         {
            category:
            currentLesson.category
         },

         {
            emotionalTone:
            currentLesson.emotionalTone
         }
      ]
   };

   const result =
   await lessonsCollection
   .find(query)
   .limit(6)
   .toArray();

   res.send(result);
});



app.get('/featured-lessons', async(req, res) => {

   const query = {

      // isFeatured: true,

      
   };

   const result =
   await lessonsCollection
   .find(query)
   .limit(6)
   .toArray();

   res.send(result);
});



app.get('/top-contributors', async(req, res) => {

   const result =
   await lessonsCollection.aggregate([

      {
         $group: {

            _id: "$creatorEmail",

            creatorName: {
               $first: "$creatorName"
            },

            creatorPhoto: {
               $first: "$creatorPhoto"
            },

            totalLessons: {
               $sum: 1
            }
         }
      },

      {
         $sort: {
            totalLessons: -1
         }
      },

      {
         $limit: 6
      }

   ]).toArray();

   res.send(result);
});

app.get('/most-saved-lessons', async(req, res) => {

   const result =
   await lessonsCollection
   .find({
      privacy: 'Public'
   })
   .sort({
      favoritesCount: -1
   })
   .limit(6)
   .toArray();

   res.send(result);
});




app.get('/dashboard-stats/:email', async(req, res) => {

   const email = req.params.email;

   // total lessons
   const totalLessons =
   await lessonsCollection.countDocuments({

      creatorEmail: email
   });

   // total favorites
   const totalFavorites =
   await favoritesCollection.countDocuments({

      userEmail: email
   });

   // recent lessons
   const recentLessons =
   await lessonsCollection

   .find({
      creatorEmail: email
   })

   .sort({
      createdAt: -1
   })

   .limit(5)

   .toArray();

   res.send({

      totalLessons,

      totalFavorites,

      recentLessons
   });
});


app.get('/favorites/:email', async(req, res) => {

   const email = req.params.email;

   const {
      category,
      emotionalTone
   } = req.query;

   const query = {

      userEmail: email
   };

   // favorites
   const favorites =
   await favoritesCollection
   .find(query)
   .toArray();

   // lesson ids
   const lessonIds =
   favorites.map(fav =>
      new ObjectId(fav.lessonId)
   );

   // lesson query
   const lessonQuery = {

      _id: {
         $in: lessonIds
      }
   };

   // filter category
   if(category){

      lessonQuery.category = category;
   }

   // filter emotional tone
   if(emotionalTone){

      lessonQuery.emotionalTone =
      emotionalTone;
   }

   const result =
   await lessonsCollection
   .find(lessonQuery)
   .toArray();

   res.send(result);
});

app.delete('/favorites/:lessonId/:email', async(req, res) => {

   const {
      lessonId,
      email
   } = req.params;

   // remove favorite
   const result =
   await favoritesCollection.deleteOne({

      lessonId,

      userEmail: email
   });

   // decrease count
   await lessonsCollection.updateOne(

      {
         _id: new ObjectId(lessonId)
      },

      {
         $inc: {
            favoritesCount: -1
         }
      }
   );

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
