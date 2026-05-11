const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config();
const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const { MongoClient, ServerApiVersion } = require('mongodb');
const { ObjectId } = require('mongodb');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const port = process.env.PORT || 3000

const admin = require("firebase-admin");

// const serviceAccount = require("./firebase-adminsdk.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});







// Middleware to parse JSON bodies

app.use(cors())

// app.use(
//    '/webhook',
//    express.raw({ type: 'application/json' })
// );
app.use(express.json());

const verifyFirebaseToken =
async(req, res, next) => {

   const authHeader =
   req.headers.authorization;

   if(!authHeader){

      return res.status(401).send({

         message: 'unauthorized access'
      });
   }

   const token =
   authHeader.split(' ')[1];

   try {

      const decoded =
      await admin.auth()

      .verifyIdToken(token);

      req.decoded = decoded;

      next();

   } catch(error){

      return res.status(401).send({

         message: 'unauthorized access'
      });
   }
};

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

   const adminActivitiesCollection = db.collection("adminActivities");






   const verifyAdmin = async(req, res, next) => {

   const email =
   req.decoded.email;

   const user =
   await usersCollection.findOne({

      email
   });

   if(user?.role !== "admin"){

      return res.status(403).send({

         message: 'forbidden access'
      });
   }

   next();
};


// API endpoint to create a new user
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
      user.isBanned = false;
      user.createdAt = new Date();
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

// ...API endpoint to get all users, only for admin
    app.get('/users', async(req, res) => {

   const users =
   await usersCollection.find().toArray();

   // add total lessons count
   const usersWithLessons =
   await Promise.all(

      users.map(async(user) => {

         const totalLessons =
         await lessonsCollection.countDocuments({

            creatorEmail: user.email
         });

         return {

            ...user,

            totalLessons
         };
      })
   );

   res.send(usersWithLessons);
});


app.get('/users/email/:email', async(req, res) => {

   const email = req.params.email;

   const user =
   await usersCollection.findOne({

      email
   });

   res.send(user);
});

//...API endpoint to make a user admin, only for existing admin
app.patch('/users/admin/:id', verifyFirebaseToken, verifyAdmin, async(req, res) => {

   const id = req.params.id;

   const result =
   await usersCollection.updateOne(

      {
         _id: new ObjectId(id)
      },

      {
         $set: {
            role: 'admin'
         }
      }
   );
     // save admin activity
      await adminActivitiesCollection.insertOne({

         adminEmail:
         req.decoded.email,

         action: "Made Admin",

         targetUserEmail:
         user?.email,

         targetUserName:
         user?.name,

         timestamp: new Date()
      });

   res.send(result);
});

//...API endpoint to delete a user, only for admin
app.delete(

   '/users/:id',

   verifyFirebaseToken,

   verifyAdmin,

   async(req, res) => {

      const id =
      req.params.id;

      // find user first
      const user =
      await usersCollection.findOne({

         _id: new ObjectId(id)
      });

      // delete user
      const result =
      await usersCollection.deleteOne({

         _id: new ObjectId(id)
      });

      // save admin activity
      await adminActivitiesCollection.insertOne({

         adminEmail:
         req.decoded.email,

         action: "Deleted User",

         deletedUserEmail:
         user?.email,

         deletedUserName:
         user?.name,

         timestamp: new Date()
      });

      res.send(result);
});

// now create a toggle endpoint for banning/unbanning users
//...API endpoint to toggle ban/unban a user, only for admin
app.patch('/users/ban-toggle/:id',

   verifyFirebaseToken,

   verifyAdmin,

   async(req, res) => {

      const id =
      req.params.id;

      // find user
      const user =
      await usersCollection.findOne({

         _id: new ObjectId(id)
      });

      // toggle ban
      const result =
      await usersCollection.updateOne(

         {
            _id: new ObjectId(id)
         },

         {
            $set: {

               isBanned:
               !user?.isBanned
            }
         }
      );

      // save activity
      await adminActivitiesCollection.insertOne({

         adminEmail:
         req.decoded.email,

         action:

         user?.isBanned
         ?

         "Unbanned User"

         :

         "Banned User",

         targetUserEmail:
         user?.email,

         targetUserName:
         user?.name,

         timestamp: new Date()
      });

      res.send(result);
});



    // API endpoint to create a new lesson
//...API endpoint to create a new lesson, only for logged in users, and also save the creator email and name from decoded token
    app.post('/lessons', async(req, res) => {

   const lesson = req.body;

      // default fields
   lesson.likes = [];
   lesson.favorites=[];

   lesson.likesCount = 0;

   lesson.favoritesCount = 0;

   lesson.updatedAt = new Date();

   lesson.createdAt = new Date();
   
   lesson.isFeatured= false;

   lesson.isReviewed= false;

   lesson.reportCount= 0;


   const result = await lessonsCollection.insertOne(lesson);

   res.send(result);
});

//...API endpoint to get all lessons of a user by email, only for logged in users and also verify the email from decoded token
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



// ...API endpoint to delete a lesson by ID, only by admin
app.delete('/lessons/:id',verifyFirebaseToken,async(req, res) => {

      const id =
      req.params.id;

      // find lesson first
      const lesson =
      await lessonsCollection.findOne({

         _id: new ObjectId(id)
      });

      // delete lesson
      const result =
      await lessonsCollection.deleteOne({

         _id: new ObjectId(id)
      });

      // save admin activity
      await adminActivitiesCollection.insertOne({

         adminEmail:
         req.decoded.email,

         action: "Deleted Lesson",

         lessonTitle:
         lesson?.title,

         lessonCreator:
         lesson?.creatorEmail,

         timestamp: new Date()
      });

      res.send(result);
});


    //...API endpoint to update a lesson by ID, only by creator or admin, and also update the updatedAt field
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

//...API endpoint to update lesson privacy, only by creator or admin
app.patch('/lessons/privacy/:id', verifyFirebaseToken, async(req, res) => {

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

//...API endpoint to update lesson access level, only by creator or admin
app.patch('/lessons/access/:id',verifyFirebaseToken, async(req, res) => {

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
//...API endpoint to get lesson details by ID, only for public lessons or if the requester is the creator or 
app.get('/lessons/:id',verifyFirebaseToken, async(req, res) => {

   const id = req.params.id;

   const query = {
      _id: new ObjectId(id)
   };

   const result = await lessonsCollection.findOne(query);

   res.send(result);
});



//...Public Lesson Show in Admin User Profile Which Admin Created Lesson
app.get('/public-lessons/:email',verifyFirebaseToken, async(req, res) => {

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


//...public lessonpage e search and filter option add korar api, can show admin feature added card and also show in reported lesson page for admin review and action
app.get('/public-lessons', async (req, res) => {

   const {
      category,
      emotionalTone,
      search
   } = req.query;

   const query = {
      privacy: 'Public'
   };

   // category filter
   if (category) {
      query.category = category;
   }

   // emotional tone filter
   if (emotionalTone) {
      query.emotionalTone = emotionalTone;
   }

   // search filter
   if (search) {
      query.title = {
         $regex: search,
         $options: 'i'
      };
   }

   const result = await lessonsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

   res.send(result);
});



app.patch('/users/profile/:email', async(req, res) => {

   const email = req.params.email;

   const { name, photoURL } = req.body;

   const result =
   await usersCollection.updateOne(

      { email },

      {
         $set: {
            name,
            photoURL
         }
      }
   );

   res.send(result);
});







//...Admin Delete Lesson API, can show admin feature added card and also show in reported lesson page for admin review and action
app.delete('/admin-lessons/:id',verifyFirebaseToken, verifyAdmin, async(req, res) => {

   const id = req.params.id;

   // find lesson
   const lesson =
   await lessonsCollection.findOne({

      _id: new ObjectId(id)
   });

   // delete
   const result =
   await lessonsCollection.deleteOne({

      _id: new ObjectId(id)
   });

   // save admin activity
   await adminActivitiesCollection.insertOne({

      adminEmail: req.decoded?.email, 

      action: "Deleted Lesson",

      lessonTitle: lesson?.title,

      timestamp: new Date()
   });

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



app.patch('/lessons/like/:id',verifyFirebaseToken, async(req, res) => {

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


app.post('/favorites', verifyFirebaseToken, async(req, res) => {

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


// app.patch('/favorites/:lessonId', async(req, res) => {

//    const lessonId = req.params.lessonId;

//    const { userEmail } = req.body;

//    // already favorite?
//    const existingFavorite =
//    await favoritesCollection.findOne({

//       lessonId,
//       userEmail
//    });

//    // REMOVE
//    if(existingFavorite){

//       await favoritesCollection.deleteOne({

//          _id: existingFavorite._id
//       });

//       await lessonsCollection.updateOne(

//          {
//             _id: new ObjectId(lessonId)
//          },

//          {
//             $inc: {
//                favoritesCount: -1
//             }
//          }
//       );

//       return res.send({

//          favorited: false
//       });
//    }

//    // ADD
//    await favoritesCollection.insertOne({

//       lessonId,
//       userEmail,
//       createdAt: new Date()
//    });

//    await lessonsCollection.updateOne(

//       {
//          _id: new ObjectId(lessonId)
//       },

//       {
//          $inc: {
//             favoritesCount: 1
//          }
//       }
//    );

//    res.send({

//       favorited: true
//    });
// });

app.patch('/favorites/:lessonId', verifyFirebaseToken, async (req, res) => {

  const lessonId = req.params.lessonId;

  const { userEmail } = req.body;

  // already favorite?
  const existingFavorite =
  await favoritesCollection.findOne({

    lessonId,
    userEmail
  });

  // REMOVE FAVORITE
  if (existingFavorite) {

    // remove from favorites collection
    await favoritesCollection.deleteOne({

      _id: existingFavorite._id
    });

    // update lesson
    await lessonsCollection.updateOne(

      {
        _id: new ObjectId(lessonId)
      },

      {
        $inc: {

          favoritesCount: -1
        },

        $pull: {

          favorites: userEmail
        }
      }
    );

    return res.send({

      favorited: false
    });
  }

  // ADD FAVORITE
  await favoritesCollection.insertOne({

    lessonId,

    userEmail,

    createdAt: new Date()
  });

  // update lesson
  await lessonsCollection.updateOne(

    {
      _id: new ObjectId(lessonId)
    },

    {
      $inc: {

        favoritesCount: 1
      },

      $addToSet: {

        favorites: userEmail
      }
    }
  );

  res.send({

    favorited: true
  });
});



//...API endpoint to get all favorites of a user by email, only for logged in users and also verify the email from decoded token
app.get('/favorites', verifyFirebaseToken, async(req, res) => {

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

//...API endpoint to delete a favorite by ID, only by creator or admin
app.delete('/favorites/:id', verifyFirebaseToken, async(req, res) => {

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



app.post('/comments', verifyFirebaseToken, async(req, res) => {

   const comment = req.body;

   const result =
   await commentsCollection.insertOne(
      comment
   );

   res.send(result);
});


app.get('/comments/:lessonId', verifyFirebaseToken, async(req, res) => {

   const lessonId = req.params.lessonId;

   const query = { lessonId };

   const result =
   await commentsCollection
   .find(query)
   .sort({ createdAt: -1 })
   .toArray();

   res.send(result);
});

app.delete('/comments/:id', verifyFirebaseToken, async (req, res) => {

  const id = req.params.id;

  const result =
  await commentsCollection.deleteOne({

    _id: new ObjectId(id)
  });

  res.send(result);
});



app.post('/reports', verifyFirebaseToken, async(req, res) => {

   const reportData = req.body;

   // save report
   const result =
   await reportsCollection.insertOne(

      reportData
   );

   // increase report count
   await lessonsCollection.updateOne(

      {
         _id: new ObjectId(
            reportData.lessonId
         )
      },

      {
         $inc: {

            reportCount: 1
         }
      }
   );

   res.send(result);
});



app.get('/similar-lessons', verifyFirebaseToken, async(req, res) => {

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

app.get('/similar-lessons/:id', verifyFirebaseToken, async(req, res) => {

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


//............................Home Page APIs................................

// home page e feaured lessons show api, can show admin feature added card
app.get('/featured-lessons',  async(req, res) => {

   const query = {
      privacy: 'Public',

      isFeatured: true
   };

   const result =
   await lessonsCollection
   .find(query)
   .limit(6)
   .toArray();

   res.send(result);
});

// home page e top contributors show api, can show admin feature added card
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

// home page e most saved lessons show api, can show admin feature added card
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



//.............................Dashboard APIs................................
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

   // public lessons
   const publicLessons =
   await lessonsCollection.countDocuments({

      creatorEmail: email,

      privacy: "Public"
   });

    // total reports
   const totalReports =
   await reportsCollection.countDocuments({

      reportedUserEmail: email
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
      publicLessons,
      totalReports,

      recentLessons
   });
});


app.get('/favorites/:email', verifyFirebaseToken, async(req, res) => {

   const email = req.params.email;
   console.log('headers', req.headers);

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

app.delete('/favorites/:lessonId/:email', verifyFirebaseToken, async(req, res) => {

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





//admom related API endpoints can be added here, for example:


//...Dashboard e stats show korar api, can show admin feature added card and also show in reported lesson page for admin review and action
app.get('/admin-stats', async(req, res) => {

   // total users
   const totalUsers =
   await usersCollection.countDocuments();

   // total public lessons
   const totalLessons =
   await lessonsCollection.countDocuments({

      privacy: 'Public'
   });

   // total reports
   const totalReports =
   await reportsCollection.countDocuments();

   // today's lessons
   const today = new Date();

   today.setHours(0,0,0,0);

   const todaysLessons =
   await lessonsCollection.countDocuments({

      createdAt: {
         $gte: today
      }
   });

   // top contributors
   const topContributors =
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
         $limit: 5
      }

   ]).toArray();

   res.send({

      totalUsers,

      totalLessons,

      totalReports,

      todaysLessons,

      topContributors
   });
});

//...Admin Lessons Show in Admin Dashboard with filter option, can show admin feature added card and also show in reported lesson page for admin review and action
app.get('/admin-lessons', async(req, res) => {

   const {
      category,
      privacy,
      flagged
   } = req.query;

   const query = {};

   // category filter
   if(category){

      query.category = category;
   }

   // privacy filter
   if(privacy){

      query.privacy = privacy;
   }

   // flagged filter
   if(flagged === "true"){

      query.reportCount = {
         $gt: 0
      };
   }

   const lessons =
   await lessonsCollection
   .find(query)
   .sort({
      createdAt: -1
   })
   .toArray();

   res.send(lessons);
});

//...Admin Featured Lesson Toggle API, can show admin feature added card and also show in reported lesson page for admin review and action
app.patch('/featured-lessons/:id',verifyFirebaseToken, verifyAdmin, async(req, res) => {

   const id = req.params.id;

   const { featured } = req.body;

   // find lesson
   const lesson =
   await lessonsCollection.findOne({

      _id: new ObjectId(id)
   });

   // update
   const result =
   await lessonsCollection.updateOne(

      {
         _id: new ObjectId(id)
      },

      {
         $set: {

            isFeatured: featured
         }
      }
   );


   res.send(result);
});


//...Admin Reviewed Lesson Toggle API, can show admin feature added card and also show in reported lesson page for admin review and action, after review the lesson will be marked as reviewed and also save this activity in admin activity collection
app.patch('/reviewed-lessons/:id', verifyFirebaseToken, verifyAdmin, async(req, res) => {

   const id = req.params.id;

    // lesson
   const lesson =
   await lessonsCollection.findOne({

      _id: new ObjectId(id)
   });

   // update
   const result =
   await lessonsCollection.updateOne(

      {
         _id: new ObjectId(id)
      },

      {
         $set: {
            isReviewed: true
         }
      }
   );

   // activity save
   await adminActivitiesCollection.insertOne({

      adminEmail: req.decoded?.email,

      action: "Reviewed Lesson",

      lessonTitle: lesson?.title,

      timestamp: new Date()
   });

   res.send(result);
});

//...Dashboard e lesson stats show korar api, can show admin feature added card and also show in reported lesson page for admin review and action
app.get('/lesson-stats', async(req, res) => {

   const publicLessons =
   await lessonsCollection.countDocuments({

      privacy: 'Public'
   });

   const privateLessons =
   await lessonsCollection.countDocuments({

      privacy: 'Private'
   });

   const flaggedLessons =
   await lessonsCollection.countDocuments({

      reportCount: {
         $gt: 0
      }
   });

   res.send({

      publicLessons,

      privateLessons,

      flaggedLessons
   });
});

//....Dashboard e reported lesson show korar api, can show admin feature added card and also show in reported lesson page for admin review and action
app.get('/reported-lessons', async(req, res) => {

   const lessons =
   await lessonsCollection.find({

      reportCount: {
         $gt: 0
      }
   })
   .sort({
      reportCount: -1
   })
   .toArray();

   res.send(lessons);
});
//...Admin Reported Lesson Review Page e report details show korar api, can show admin feature added card and also show in reported lesson page for admin review and action
app.get('/lesson-reports/:id', async(req, res) => {

   const lessonId = req.params.id;

   const reports =
   await reportsCollection.find({

      lessonId
   }).toArray();

   res.send(reports);
});

//...Admin Ignore Reported Lesson API, can show admin feature added card and also show in reported lesson page for admin review and action, after ignore the report count will be reset and also delete all reports for that lesson
app.patch('/ignore-reports/:id',verifyFirebaseToken, verifyAdmin, async(req, res) => {

   const lessonId = req.params.id;

   // lesson
   const lesson =
   await lessonsCollection.findOne({

      _id: new ObjectId(lessonId)
   });

   // reset report count
   await lessonsCollection.updateOne(

      {
         _id: new ObjectId(lessonId)
      },

      {
         $set: {
            reportCount: 0
         }
      }
   );

   // delete reports
   await reportsCollection.deleteMany({

      lessonId
   });

   // activity save
   await adminActivitiesCollection.insertOne({

      adminEmail: req.decoded?.email,

      action: "Ignored Reports",

      lessonTitle: lesson?.title,

      timestamp: new Date()
   });

   res.send({
      success: true
   });
});

//...Admin Activity Show in admin Profile Page Which Work in admin our website
app.get('/admin-activity/:email', verifyFirebaseToken, verifyAdmin, async(req, res) => {

   const email = req.params.email;

   // total actions
   const totalActions =
   await adminActivitiesCollection.countDocuments({

      adminEmail: email
   });

   // deleted lessons
   const deletedLessons =
   await adminActivitiesCollection.countDocuments({

      adminEmail: email,

      action: "Deleted Lesson"
   });

 

   //deleted users

   const deletedUsers =
await adminActivitiesCollection.countDocuments({

   adminEmail: email,

   action: "Deleted User"
});

   // reviewed lessons
   const reviewedLessons =
   await adminActivitiesCollection.countDocuments({

      adminEmail: email,

      action: "Reviewed Lesson"
   });

   //admin

   const madeAdmins =await adminActivitiesCollection.countDocuments({

   adminEmail: email,

   action: "Made Admin"
});

   // ignored reports
   const ignoredReports =await adminActivitiesCollection.countDocuments({

      adminEmail: email,

      action: "Ignored Reports"
   });

   // banned users
  const bannedUsers =
await adminActivitiesCollection.countDocuments({

   adminEmail: email,

   action: "Banned User"
});
//unbanned users
const unbannedUsers =
await adminActivitiesCollection.countDocuments({

   adminEmail: email,

   action: "Unbanned User"
});

   res.send({

      totalActions,

      deletedLessons,

     

      reviewedLessons,
      deletedUsers,

      ignoredReports,
      madeAdmins,

       bannedUsers,

   unbannedUsers
   });
});

//... User Summery record api Which work inwebsite show this record in profile page..
app.get('/user-summary/:email', async(req, res) => {

   const email = req.params.email;

   // total lessons
   const totalLessons =
   await lessonsCollection.countDocuments({

      creatorEmail: email
   });

   // public lessons
   const publicLessons =
   await lessonsCollection.countDocuments({

      creatorEmail: email,

      privacy: "Public"
   });

   // saved lessons
   const totalSaved =
   await favoritesCollection.countDocuments({

      userEmail: email
   });

   // reports
   const totalReports =
   await reportsCollection.countDocuments({

      reportedUserEmail: email
   });

   res.send({

      totalLessons,

      publicLessons,

      totalSaved,

      totalReports
   });
});







    // Payment related API endpoints can be added here, for example:

    //Stipe checkout session create API
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

// user er premium korar api, can be used after payment success or by admin from dashboard
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
