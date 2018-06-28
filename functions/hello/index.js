const handlebars = require('handlebars');
const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs"));
var vcf = require("vcf")

const bucket = 'digital.business.card'
const config = new AWS.Config({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION
});
AWS.config.update(config);

console.log('starting function')

exports.handle = (event, context, callback) => {
	console.log('processing event: %j', event)
    
    // Generate UUIDs for eaach card and image group to prevent filename conflicts
    const cardId = toUrlString(randomBytes(16));
    const imageId = toUrlString(randomBytes(16));
    
    // TO-DO: Replace hardcoded handlebars context
    var context = {'full_name': 'Preston Lim',
                    'first_name': 'Preston',
                    'last_name': 'Lim', 
                    'role': 'Associate Software Engineer', 
                    'company': 'Data Science Division, GovTech',
                    'email': 'preston@data.gov.sg',
                    'phone_number': '+65 9123 4567',
                    'website': 'https://tech.gov.sg',
                    'address': '1 Fusionopolis, Sandcrawler, #09-01, 138577'
                    };

    var readFileName = './assets/index.html';
    var writeFileName = '/tmp/index.html'; // Note: You can only write to the '/tmp' directory in AWS Lambda
    var vcfName = '/tmp/user.vcf';

    // Step 1: Generate the static HTML website using the user input
    var promiseStep1 = renderTemplate(context, readFileName, writeFileName, bucket, cardId)
    
    // Step 2: Generate the VCF using the user input
    var promiseStep2 = generateVCard(context);

    // Step 3: Generate the QR code file
    var promiseStep3 = new Promise.resolve(1);

    // Step 4: Upload all relevant files to S3
    Promise.all([promiseStep1, promiseStep2, promiseStep3])
    .then(uploadToS3(writeFileName, vcfName))
    .catch(function (err) {
        console.error(err);
        throw err;
    });

    
    // Step 5: Store the user input and file information into the dynamoDB table
    // then return the CardId to the user/QR code IP address
    recordCardInfo(cardId).then(() => {
        callback(null, { url: 'url' });
    }).catch((err) => {
        console.error(err);
        errorResponse(err.message, context.awsRequestId, callback);
    });

    // callback(null, { test: 'success' })
};

function uploadToS3(writeFileName, vcfName) {

    // Create promises:
    // a) Upload rendered HTML
    // b) Upload VCF
    // c) Upload rendered QR code
    // d) Upload images: company logo + personal profile picture

    // Return array of promises

    var params = {Bucket: bucket, Key: cardId + '/index.html', Body: renderedTemplate};
    s3.upload(params, function(err, data) {
      console.log(err, data);
    });
}

// Generate the VCF using 'vcf'
function generateVCard(context, vcfName){
    return new Promise((resolve, reject) => {
        var newCard = new vcf();
        var jcard = [ "vcard",
          [
            [ "version", {}, "text", "4.0" ],
            [ "n", {}, "text", [ "Gump", "Forrest", "", "", "" ] ],
            [ "fn", {}, "text", "Forrest Gump" ],
            [ "org", {}, "text", "Bubba Gump Shrimp Co." ],
            [ "title", {}, "text", "Shrimp Man" ],
            [ "tel", { "type": [ "work", "voice" ], "value": "uri" }, "uri", "tel:+11115551212" ],
            [
              "adr", { "type": "work", "label":"\"100 Waters Edge\\nBaytown, LA 30314\\nUnited States of America\"" },
              "text", [ "", "", "100 Waters Edge", "Baytown", "LA", "30314", "United States of America" ]
            ],
            [ "email", {}, "text", "forrestgump@example.com" ]
          ]
        ];

        var testCard = new vcf.fromJSON(jcard);
        console.log(testCard.toString('4.0'));

        return fs.writeFileAsync(vcfName, newCard.toString('4.0'));
    })
}

// Use handlebars to render the HTML from template; returns a Promise
function renderTemplate(context, readFileName, writeFileName, bucket, cardId) {
    return fs.readFileAsync(readFileName)
    .then((data) => {
        var source = "\'" + data + "\'"; // To convert the buffer stream into a string
        var template = handlebars.compile(source); // Handlebars at work
        return fs.writeFileAsync(writeFileName, template(context));
    });
}

// Put the user input into dynamoDB
function recordCardInfo(cardId) {
    return ddb.put({
        TableName: 'GenerateBusinessCards',
        Item: {
            CardId: cardId,
            RequestTime: new Date().toISOString(),
        },
    }).promise();
}


// Generate a usable URL string from the random bytes
function toUrlString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Return a helpful error message
function errorResponse(errorMessage, awsRequestId, callback) {
  callback(null, {
    statusCode: 500,
    body: JSON.stringify({
      Error: errorMessage,
      Reference: awsRequestId,
    }),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}