import express from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Stripe from "stripe";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_API_KEY, {
  apiVersion: "2022-11-15", // Use the appropriate API version
});
const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());
app.use(cookieParser());
const uri = `mongodb+srv://jins:${process.env.DB_PASSWORD}@cluster0.6mg1vml.mongodb.net/mern-yogamaster`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const verifyJWT = async (req, res, next) => {
  //console.log(req.headers.authorization);
  const authorization = req.headers.authorization;
  // console.log("authorization   "  +authorization);

  if (!authorization) {
    return res.status(401).send({
      error: true,
      message: "Unauthorize access1",
    });
  }
  const token = authorization?.split(" ")[1];
  // console.log("token   "  +token);
  jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "forbidden user or token has expired" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    await client.connect(); // Ensure the client connects to the database
    const database = client.db("mern-yogamaster");
    const userCollection = database.collection("users");
    const classesCollection = database.collection("classes");
    const cartCollection = database.collection("cart");
    const enrolledCollection = database.collection("enrolled");
    const paymentCollection = database.collection("payments");
    const appliedCollection = database.collection("applied");
    //middleware

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user.role === "admin") {
        next();
      } else {
        return res
          .status(401)
          .send({ error: true, message: "Unauthorize access" });
      }
    };
    // Creating new user
    app.post("/new-user", async (req, res) => {
      //console.log(req.body)
      const newUser = req.body;
      const result = await userCollection.insertOne(newUser);
      res.status(200).json({
        message: "Successfully created user",
        data: result,
      });
    });
    // verify instructor

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user.role === "instructor" || user.role === "admin") {
        next();
      } else {
        res.status(200).json({
          message: "Successfully created user",
          data: result,
        });
      }
    };
    // Setting token for login users
    app.post("/api/set-token", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET, {
        expiresIn: "24h",
      });
      res.json({
        token: token,
      });
    });

    // Get all users registered in the application
    app.get("/getallusers", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // Get single user by ID
    app.get("/user/id/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    // Get single user by email ID
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      res.send(user);
    });

    // Delete single user by ID
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    // delete user
    app.delete("/delete-user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    // Update user by ID
    app.put("/update-user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = req.body;
      const options = { upsert: true };
      const updatedDoc = await userCollection.updateOne(
        filter,
        {
          $set: {
            name: updateDoc.name,
            email: updateDoc.email,
            role: updateDoc.role,
            address: updateDoc.address,
            phone: updateDoc.phone,
            about: updateDoc.about,
            photoUrl: updateDoc.photoUrl,
            skills: updateDoc.skills ? updateDoc.skills : null,
          },
        },
        options
      );
      res.send(updatedDoc);
    });
    //updating a class
    app.put(
      "/update-class/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        // console.log(req.body)
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const Doc = req.body;
        const options = { upsert: true };
        const updatedDoc = await classesCollection.updateOne(
          filter,
          {
            $set: {
              courseName: Doc.courseName,
              imageUrl: Doc.imageUrl,
              instructorEmail: Doc.instructorEmail,
              instructorName: Doc.instructorName,
              seat: Doc.seat,
              price: Doc.price,
              link: Doc.link,
              description: Doc.description,
              status: Doc.status,
              totalenrolled: Doc.totalenrolled,
              submitted: Doc.submitted,
            },
          },
          options
        );
        res.send(updatedDoc);
      }
    );
    // Creating a new class
    app.post("/new-class", verifyJWT, verifyInstructor, async (req, res) => {
      // console.log(req.body);
      const newClass = req.body;
      const createdClass = await classesCollection.insertOne(newClass);
      res.send(createdClass);
    });

    // Get all classes added by instructor
    app.get(
      "/classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = { instructorEmail: email };
        const instructorClasses = await classesCollection.find(query).toArray();
        res.send(instructorClasses);
      }
    );
    //get all pending class of a instructor
    app.get(
      "/pendingclasses/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = { instructorEmail: email, status: "pending" };
        const pendingclass = await classesCollection.find(query).toArray();
        res.send(pendingclass);
      }
    );
    // get all approved class of a instructor
    app.get(
      "/approvedclass/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = { instructorEmail: email, status: "approved" };
        const approvedclass = await classesCollection.find(query).toArray();
        res.send(approvedclass);
      }
    );
    // Get all approved classes
    app.get("/getallclasses", async (req, res) => {
      const query = { status: "approved" };
      const result = await classesCollection.find(query).toArray();
     // console.log(result)
      res.send(result);
    });

    // Get all classes (both approved and unapproved)
    app.get("/classes-manage", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    // Change the status of class (for admin purpose)
    app.put("/change-status/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const status = req.body.status;
      const reason = req.body.reason;
      const updateDoc = {
        $set: {
          status: status,
          reason: reason,
        },
      };
      const result = await classesCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // Update a class
    app.put(
      "/change-class/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateDoc = req.body;
        const updatedDoc = {
          $set: {
            name: updateDoc.name,
            description: updateDoc.description,
            price: updateDoc.price,
            availableSeats: updateDoc.availableSeats,
            videoLink: updateDoc.videoLink,
            status: "pending",
          },
        };
        const result = await classesCollection.updateOne(
          filter,
          updatedDoc,
          options
        );
        res.send(result);
      }
    );

    // Get single class for details page
    app.get("/classes/id/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.findOne(query);
      res.send(result);
    });

    // Get all instructors
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // Adding items to the cart
    app.post("/add-to-cart", verifyJWT, async (req, res) => {
      console.log(req.body);
      const cartItems = req.body;
      const result = await cartCollection.insertOne(cartItems);
      res.send(result);
    });

    // Checking the classes which are already enrolled by the user

    app.get("/cart/:email", verifyJWT, async (req, res) => {
      try {
        const email = req.params.email;
        console.log("email" + email);

        const query = { userEmail: email };
        const projection = { classId: 1 };

        // Fetch cart items with the specified email
        const carts = await cartCollection
          .find(query, { projection })
          .toArray();
        // console.log("Carts fetched:", carts);

        // Extract class IDs from the cart items and validate them
        const classIds = carts
          .map((cart) => {
            if (ObjectId.isValid(cart.classId)) {
              return new ObjectId(cart.classId);
            } else {
              console.error(`Invalid ObjectId: ${cart.classId}`);
              return null;
            }
          })
          .filter((id) => id !== null); // Filter out invalid ObjectIds

        if (classIds.length === 0) {
          return res.status(200).send([]); // If no valid class IDs, return empty array
        }

        const query2 = { _id: { $in: classIds } };

        // Fetch class details based on the class IDs
        const result = await classesCollection.find(query2).toArray();

        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching cart items:", error);
        res
          .status(500)
          .send({ error: "An error occurred while fetching cart items." });
      }
    });

    // Get cart of specified email of user
    app.get("/cart/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { userEmail: email };
      const projection = { classId: 1 };
      const carts = await cartCollection.find(query, { projection }).toArray();
      const classIds = carts.map((cart) => cart.classId);
      console.log(classIds);
      const _id = new ObjectId(classIds);
      console.log(_id);
      // const query2 = { _id: { $in: classIds } };
      const result = await classesCollection.find(_id).toArray();
      res.send(result);
    });

    // Delete cart items

    app.delete("/delete-cart-items/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { classId: id };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    // Create payment intent
    // Example backend endpoint
    app.post("/create-payment-intent", async (req, res) => {
      const { price, description } = req.body;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: price * 100, // convert to smallest currency unit
          currency: "usd",
          payment_method_types: ["card"],
          description, // include the description
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Payment info
    // app.post("/payment-info", verifyJWT, async (req, res) => {
    //   try {
    //     // console.log(req.body.body);
    //     // console.log("classid" + req.body.body.classId);
    //     const classesId = req.body.body.classId;
    //     const userEmail = req.body.body.userEmail;
    //     const transactionId = req.body.body.transitionId;
    //     // console.log(classesId+"   "+userEmail+" "+ transactionId)
    //     // Validate classesId
    //     if (!Array.isArray(classesId)) {
    //       throw new Error("Invalid classesId. Expected an array.");
    //     }

    //     const singleClassId = req.query.classId;
    //     let query;
    //     if (singleClassId) {
    //       query = { classId: singleClassId, userMail: userEmail };
    //     } else {
    //       query = { classId: { $in: classesId } };
    //     }

    //     // Convert classesId array to ObjectId array
    //     const objectIdArray = classesId.map((id) => new ObjectId(id));

    //     const classesQuery = { _id: { $in: objectIdArray } };

    //     // Fetch classes information from MongoDB
    //     const classes = await classesCollection.find(classesQuery).toArray();

    //     // Calculate updated enrollment and seats availability
    //     const totalEnrolled =
    //       classes.reduce(
    //         (total, current) => total + (current.totalEnrolled || 0),
    //         0
    //       ) + 1;
    //     const availableSeats =
    //       classes.reduce(
    //         (total, current) => total + (current.availableSeats || 0),
    //         0
    //       ) - 1;

    //     // Prepare data for new enrollment
    //     const newEnrolledData = {
    //       userEmail,
    //       classesId: objectIdArray,
    //       transactionId,
    //     };

    //     // Update documents in MongoDB collections
    //     const updatedDoc = {
    //       $set: {
    //         totalEnrolled,
    //         availableSeats,
    //       },
    //     };

    //     // Update classes collection with new enrollment data
    //     const updatedResult = await classesCollection.updateMany(
    //       classesQuery,
    //       updatedDoc,
    //       { upsert: true }
    //     );

    //     // Insert enrollment data into enrolled collection
    //     const enrolledResult = await enrolledCollection.insertOne(
    //       newEnrolledData
    //     );

    //     // Delete cart items from cart collection
    //     const deletedResult = await cartCollection.deleteMany(query);

    //     // Insert payment information into payment collection
    //     const paymentResult = await paymentCollection.insertOne(req.body);

    //     // Send response with results
    //     res.json({
    //       paymentResult,
    //       deletedResult,
    //       enrolledResult,
    //       updatedResult,
    //     });
    //   } catch (error) {
    //     console.error("Error processing payment:", error);
    //     res
    //       .status(500)
    //       .json({ error: "An error occurred during the payment process." });
    //   }
    // });

    app.post("/payment-info", verifyJWT, async (req, res) => {
      // const paymentInfo = req.body;
      console.log(req.body.body);
      const classesId = req.body.body.classId;
      const userEmail = req.body.body.userEmail;
      const transactionId = req.body.body.transitionId;
      const singleClassId = req.query.classId;
      let query;

      if (singleClassId) {
        query = { classId: singleClassId, userMail: userEmail };
      } else {
        query = { classId: { $in: classesId } };
      }
      const classesQuery = {
        _id: { $in: classesId.map((id) => new ObjectId(id)) },
      };
      const classes = await classesCollection.find(classesQuery).toArray();
      const newEnrolledData = {
        userEmail: userEmail,
        classesId: classesId.map((id) => new ObjectId(id)),
        transactionId: transactionId,
      };
      const updatedDoc = {
        $set: {
          totalEnrolled:
            classes.reduce(
              (total, current) => total + current.totalEnrolled,
              0
            ) + 1 || 0,
          availableSeats:
            classes.reduce(
              (total, current) => total + current.availableSeats,
              0
            ) - 1 || 0,
        },
      };

      const updatedResult = await classesCollection.updateMany(
        classesQuery,
        updatedDoc,
        { upsert: true }
      );
      const enrolledResult = await enrolledCollection.insertOne(
        newEnrolledData
      );
      const deletedResult = await cartCollection.deleteMany(query);
      const paymentResult = await paymentCollection.insertOne(req.body.body);
      res.send({ paymentResult, deletedResult, enrolledResult, updatedResult });
    });

    // Payment history specific users
    app.get("/payment-history/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // Payment history length
    app.get("/payment-history-length/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const totalLength = await paymentCollection.countDocuments(query);
      res.send({ totalLength });
    });

    // Enrolled routes
    app.get("/popular-classes", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ totalEnrolled: -1 })
        .limit(6)
        .toArray();
        console.log(result)
      res.send(result);
    });

    app.get("/popular-instructors", async (req, res) => {
      const pipeline = [
        {
          $group: {
            _id: "$instructorEmail",
            totalEnrolled: { $sum: "$totalEnrolled" },
          },
        },

        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $project: {
            _id: 0,
            instructor: {
              $arrayElemAt: ["$instructor", 0],
            },
            totalEnrolled: 1,
          },
        },
        {
          $sort: {
            totalEnrolled: -1,
          },
        },
        {
          $limit: 6,
        },
      ];
      const result = await classesCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    app.get("/admin-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const approvedClasses = await classesCollection.countDocuments({
        status: "approved",
      });
      const pendingClasses = await classesCollection.countDocuments({
        status: "pending",
      });
      const instructor = await userCollection.countDocuments({
        role: "instructor",
      });
      const totalClasses = await classesCollection.countDocuments();
      const totalEnrolled = await enrolledCollection.countDocuments();

      const result = {
        approvedClasses,
        pendingClasses,
        instructor,
        totalClasses,
        totalEnrolled,
      };
      res.send(result);
    });

    app.get("/enrolled-classes/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const pipeline = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: "classes",
            localField: "classesId",
            foreignField: "_id",
            as: "classes",
          },
        },
        {
          $unwind: "$classes",
        },
        {
          $lookup: {
            from: "users",
            localField: "classes.instructorEmail",
            foreignField: "email",
            as: "instructor",
          },
        },
        {
          $project: {
            _id: 0,
            classes: 1,
            instructor: {
              $arrayElemAt: ["$instructor", 0],
            },
          },
        },
      ];
      const result = await enrolledCollection.aggregate(pipeline).toArray();

      res.send(result);
    });
    // Applied route
    app.post("/apply-instructor", async (req, res) => {
      const data = req.body;
      const result = await appliedCollection.insertOne(data);
      res.send(result);
    });

    app.get("/applied-instructors/:email", async (req, res) => {
      const email = req.params.email;
      const result = await appliedCollection.findOne({ email });
      res.send(result);
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});


