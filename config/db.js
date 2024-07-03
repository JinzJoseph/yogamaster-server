import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client;

const connectDB = async () => {
  try {
    const uri = `mongodb+srv://jins:${process.env.DB_PASSWORD}@cluster0.6mg1vml.mongodb.net/mern-yogamaster`;

    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
console.log( "clinet"+client);
    await client.connect();
    console.log("Mongodb connected");

    return client;
  } catch (error) {
    console.log("Mongodb Server Issue " + error);
  }
};

export { connectDB, client };
