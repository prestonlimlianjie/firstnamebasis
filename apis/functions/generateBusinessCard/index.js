const handlebars = require('handlebars');
const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
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
    var writeFileName = cardId + '/index.html';
    var vcfName = cardId + '/user.vcf';

    // var writeFileName = '/tmp/index.html'; // Note: You can only write to the '/tmp' directory in AWS Lambda

    // Step 1: Generate the static HTML website using the user input
    // var promiseStep1 = renderTemplate(context, readFileName, writeFileName, bucket, cardId)
    renderTemplate(context, readFileName, writeFileName, bucket)
    
    // Step 2: Generate the VCF using the user input
    generateVCard(context, vcfName, bucket);

    // Step 3: Generate the QR code file
    var promiseStep3 = new Promise.resolve(1);

    
    // Step 5: Store the user input and file information into the dynamoDB table
    // then return the CardId to the user/QR code IP address
    // recordCardInfo(cardId).then(() => {
    //     callback(null, { url: 'url' });
    // }).catch((err) => {
    //     console.error(err);
    //     errorResponse(err.message, context.awsRequestId, callback);
    // });

    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS 
        },
        body: JSON.stringify({ "test": "success" })
    };
    callback(null, response)
};

function uploadToS3(fileName, body) {
    var params = {
        Bucket: bucket, 
        Key: fileName, 
        Body: body
    };
    s3.upload(params, function(err, data) {
        console.log(err, data);
        console.log('File successfully uploaded to: ' + data.Location);
    });
}

// Generate the VCF using 'vcf'
function generateVCard(context, vcfName){
    return new Promise((resolve, reject) => {
        var newCard = new vcf();

        var jcard = [ "vcard",
          [
            [ "version", {}, "text", "4.0" ],
            [ "n", {}, "text", [ context['last_name'], context['first_name'], "", "", "" ] ],
            [ "fn", {}, "text", context['full_name'] ],
            [ "org", {}, "text", context['company'] ],
            [ "title", {}, "text", context['role'] ],
            [ "tel", { "type": [ "work", "voice" ], "value": "uri" }, "uri", "tel:" + context['phone_number'] ],
            [
              "adr", { "type": "work", "label": context['address'] },
              "text", [ "", "", "100 Waters Edge", "Baytown", "LA", "30314", "United States of America" ]
            ],
            [ "email", {}, "text", context['email'] ]
          ]
        ];

        var testCard = new vcf.fromJSON(jcard);
        console.log(testCard.toString('4.0'));
        uploadToS3('users/'+vcfName, testCard.toString('4.0'));
        // return fs.writeFileAsync(vcfName, newCard.toString('4.0'));
    })
}

// Use handlebars to render the HTML from template; returns a Promise
function renderTemplate(context, readFileName, writeFileName, bucket) {
    fs.readFileAsync(readFileName)
    .then((data) => {
        var source = "\'" + data + "\'"; // To convert the buffer stream into a string
        var template = handlebars.compile(source); // Handlebars at work
        var renderedTemplate = template(context);
        uploadToS3('users/'+writeFileName, renderedTemplate);
        // return fs.writeFileAsync(writeFileName, template(context));
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