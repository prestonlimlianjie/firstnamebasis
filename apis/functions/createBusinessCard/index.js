const handlebars = require('handlebars');
const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs"));
var vcf = require("vcf");
var qr = require('qr-image');

const bucket = 'digital.business.card'
const config = new AWS.Config({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION
});
AWS.config.update(config);

console.log('starting function')

exports.handle = (event, context, callback) => {
	console.log('processing event')
    console.log(event)
    
    // Generate UUIDs for eaach card and image group to prevent filename conflicts
    const cardId = toUrlString(randomBytes(16));
    const imageId = toUrlString(randomBytes(16));
    
// {'full_name': 'Preston Lim',
//                     'first_name': 'Preston',
//                     'last_name': 'Lim', 
//                     'role': 'Associate Software Engineer', 
//                     'company': 'Data Science Division, GovTech',
//                     'email': 'preston@data.gov.sg',
//                     'phone_number': '+65 9123 4567',
//                     'website': 'https://tech.gov.sg',
//                     'address': '1 Fusionopolis, Sandcrawler, #09-01, 138577'
//                     };

    var json_object = JSON.parse(event.body)
    // TO-DO: Replace hardcoded handlebars params
    var params = {'full_name': json_object.first_name + json_object.last_name,
                    'first_name': json_object.first_name,
                    'last_name': json_object.last_name, 
                    'role': json_object.role, 
                    'company': json_object.company,
                    'email': json_object.actions.email.value,
                    'phone_number': json_object.actions.phone_number.value,
                    'website': json_object.actions.website.value,
                    'address': json_object.actions.address.value,
                    };

    console.log("printing out params...")
    console.log(params)

    const bucketURL = 'http://digital.business.card.s3-website-ap-southeast-1.amazonaws.com/';
    var readFileName = './assets/index.html';
    var mainHTMLName = 'user/' + cardId + '/index.html';
    var qrFileName = 'user/' + cardId + '/qr.png';
    var vcfName = 'user/' + cardId + '/user.vcf';

    // var writeFileName = '/tmp/index.html'; // Note: You can only write to the '/tmp' directory in AWS Lambda

    // Step 1: Generate the static HTML website using the user input
    // var promiseStep1 = renderTemplate(params, readFileName, writeFileName, bucket, cardId)
    renderTemplate(params, readFileName, mainHTMLName, bucket)
    
    // Step 2: Generate the VCF using the user input
    generateVCard(params, vcfName, bucket);

    // Step 3: Generate the QR code file
    generateQRCode(qrFileName, bucketURL + mainHTMLName);

    // Step 4: Store the user input and file information into the dynamoDB table
    // then return the CardId to the user/QR code IP address
    recordCardInfo(cardId, params).then((data) => {
        console.log('Record successfully added into dynamodb: ' + data.CardId);
        callback(null);
    }).catch((err) => {
        console.error(err);
        errorResponse(err.message, params.awsRequestId, callback);
    });

    var responseBody = {
        path: bucketURL + mainHTMLName,
    };

    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS 
        },
        body: JSON.stringify(responseBody)
    };

    console.log("response: " + JSON.stringify(response))
    callback(null, response)
};

function uploadToS3(fileName, body, isHTML) {
    if (isHTML) {
        var params = {Bucket: bucket, Key: fileName, Body: body, ContentType: 'text/html'}; 
    } else {
        var params = {Bucket: bucket, Key: fileName, Body: body};
    }

    s3.upload(params, function(err, data) {
        console.log(err, data);
        console.log('File successfully uploaded to: ' + data.Location);
    });
}

// Generate the VCF using 'vcf'
function generateVCard(params, vcfName){
    return new Promise((resolve, reject) => {
        var newCard = new vcf();

        var jcard = [ "vcard",
          [
            [ "version", {}, "text", "4.0" ],
            [ "n", {}, "text", [ params['last_name'], params['first_name'], "", "", "" ] ],
            [ "fn", {}, "text", params['full_name'] ],
            [ "org", {}, "text", params['company'] ],
            [ "title", {}, "text", params['role'] ],
            [ "tel", { "type": [ "work", "voice" ], "value": "uri" }, "uri", "tel:" + params['phone_number'] ],
            [
              "adr", { "type": "work", "label": params['address'] }
            ],
            [ "email", {}, "text", params['email'] ]
          ]
        ];

        var testCard = new vcf.fromJSON(jcard);
        console.log(testCard.toString('4.0'));
        uploadToS3(vcfName, testCard.toString('4.0'), false);
        // return fs.writeFileAsync(vcfName, newCard.toString('4.0'));
    })
}

// Use handlebars to render the HTML from template; returns a Promise
function renderTemplate(params, readFileName, writeFileName, bucket) {
    fs.readFileAsync(readFileName)
    .then((data) => {
        var source = data.toString('utf8'); // To convert the buffer stream into a string
        var template = handlebars.compile(source); // Handlebars at work
        var renderedTemplate = template(params);
        uploadToS3(writeFileName, renderedTemplate, true);
        // return fs.writeFileAsync(writeFileName, template(params));
    });
}

function generateQRCode(qrFileName, cardURL) {
    var qr_stream = qr.image(cardURL, { ec_level: 'H' });
    uploadToS3(qrFileName, qr_stream, true);    
}

// Put the user input into dynamoDB
function recordCardInfo(cardId, params) {
    return ddb.put({
        TableName: 'DigitalBusinessCards',
        Item: {
            CardId: cardId,
            Info: params,
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