import mongo from "@fastify/mongodb";
import Fastify from "fastify";
import notifier from "node-notifier";
import open from "open";
import cron from "node-cron";
import { parseString } from "xml2js";

// Inside of Fastify object you can write configuration for app
const app = Fastify({
  logger:true
});

// Main route to fetch the RSS and save it to the mongodb collection
app.get("/feed/", async function (request, reply) {
  //Main Fetch to Upwork, you can build your own on their search page
  const response = await fetch(process.env.UPWORK_RSS);
  const responseXML = await response.text();

  //Return the XML to Json
  var JobsJSON = await toJson(responseXML);

  for (const job of JobsJSON) {

    //Check for undefined values
    if (
      job &&
      job.title &&
      job.description &&
      job.guid
    ) {

      var title = job.title;
      var description = job.description;
      //extract the jobid from the guid url
      var jobId = job.guid.split("_%7E").pop().split("?source=rss")[0];

      //Mongodb Collection
      const collection = app.mongo.db.collection("jobs");

      //Insert if not exist
      const result = await collection.updateOne(
        { jobId: jobId }, // filter: specify the criteria to check for an existing document
        { $setOnInsert: { title, description, jobId, notified: false } }, // update: only set fields if inserting
        { upsert: true } // options: perform an upsert
      );
      // console.log({ success: true, id: result.insertedId });
    } else {
      //If some of the values are undefined, it will no save on the DB
      console.log({ msg: "Error saving the data" });
    }
  }
});

// Convert string/XML to JSON
async function toJson(xml) {
  var parsedXML;

  parseString(xml, { explicitArray: false }, function (error, result) {
    parsedXML = result.rss.channel.item;
  });
  parsedXML.length = 5;
  return parsedXML;
}

//Route to execute the notification in the OS
app.get("/notify/", async function (request, reply) {
  const collection = app.mongo.db.collection("jobs");
  const result = await collection.find({notified:false}).toArray();

  for (const job of result) {
    if (!job.notified) {
      notifier.notify(
        {
          title: job.title,
          message: job.description,
          sound: true, // Only Notification Center or Windows Toasters
          wait: true, // Wait with callback, until user action is taken against notification, does not apply to Windows Toasters as they always wait or notify-send as it does not support the wait option
        },
        async function (err, response, metadata) {
          if (response == "activate") {
            //Open your default browser when you click the notification
            await open("https://www.upwork.com/jobs/~" + job.jobId);
          }
        }
      );
    }
    //Update the notified field to no repeat the notifications
    await collection.updateOne(
      { notified: false, jobId: job.jobId },
      { $set: { notified: true } }
    );
  }
});

//Register MongoDB Plugin
app.register(mongo, {
  forceClose: true,
  url: "mongodb://localhost:27017/upworknotificator",
});

// Run web server
try {
  await app.listen({ port: 3000 });
  console.log('Checking for new jobs')
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

//Schedule a cron job to request the defined route every minute
cron.schedule("* * * * *", async () => {
  try {
    const responseFeed = await fetch("http://localhost:3000/feed/");
    const responseNotification = await fetch("http://localhost:3000/notify/");
  } catch (error) {}
});
