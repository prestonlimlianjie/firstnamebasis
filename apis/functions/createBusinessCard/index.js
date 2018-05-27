const handlebars = require('handlebars');
const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs"));
var qr = require('qr-image');
var vCard = require('vcards-js');


// Constants
// =========
const bucket = 'digital.business.card'
const config = new AWS.Config({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION
});
AWS.config.update(config);

console.log('starting function')


// Lambda function proper
// ======================
exports.handle = (event, context, callback) => {
    console.log('processing event')
    console.log(event)
    
    // Test input for API Gateway
    // ==========================
    // {'full_name': 'Preston Lim',
    //  'first_name': 'Preston',
    //  'last_name': 'Lim', 
    //  'role': 'Associate Software Engineer', 
    //  'company': 'Data Science Division, GovTech',
    //  'email': 'preston@data.gov.sg',
    //  'phone_number': '+65 9123 4567',
    //  'website': 'https://tech.gov.sg',
    //  'address_street': '1 Fusionopolis, Sandcrawler, #09-01',
    //  'address_city': 'Singapore',
    //  'address_stateProvince': 'Singapore',
    //  'address_postalCode': '138577',
    //  'address_countryRegion': 'Singapore'
    //  'profile_photo': [blob],
    //  'company_logo': [blob],
    // }
    
    // Generate UUIDs for eaach card and image group to prevent filename conflicts
    const cardId = toUrlString(randomBytes(16));
    var json_object = JSON.parse(event.body)
    var params = {'full_name': json_object.full_name,
                    'first_name': json_object.first_name,
                    'last_name': json_object.last_name, 
                    'role': json_object.role, 
                    'company': json_object.company,
                    'email': json_object.email,
                    'phone_number': json_object.phone_number,
                    'website': json_object.website,
                    'address_street': json_object.address_street,
                    'address_city': json_object.address_city,
                    'address_stateProvince': json_object.address_stateProvince,
                    'address_postalCode': json_object.address_postalCode,
                    'address_countryRegion': json_object.address_countryRegion,
                    'address': json_object.address_street + ", " + json_object.address_city + ", " + json_object.address_stateProvince + ", " + json_object.address_postalCode + ", " + json_object.address_countryRegion
                    // 'profile_photo': json_object.profile_photo,
                    // 'company_logo': json_object.company_logo
                    };

    console.log("printing out params...")
    console.log(params)

    const bucketURL = 'http://digital.business.card.s3-website-ap-southeast-1.amazonaws.com/';
    var readFileName = './assets/index.html';
    var mainHTMLName = 'users/' + cardId + '/index.html';
    var qrFileName = 'users/' + cardId + '/qr.png';
    var vcfName = 'users/' + cardId + '/user.vcf';

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

    // Step 1: Generate the static HTML website using the user input
    var promise1 = renderTemplate(params, readFileName, mainHTMLName, bucket)
    
    // Step 2: Generate the VCF using the user input
    var promise2 = generateVCard(params, vcfName, bucket);

    // Step 3a: Upload profile and company photo to bucket
    // var promise3ai = uploadImageToS3(cardId, 'profile.png', params.profile_photo);
    // var promise3aii = uploadImageToS3(cardId, 'logo.png', params.company_logo);

    // Step 3b: Generate the QR code file
    var promise3b = generateQRCode(qrFileName, bucketURL + mainHTMLName);

    // Step 4: Store the user input and file information into the dynamoDB table
    // then return the CardId to the user/QR code IP address

    Promise.all([promise1, promise2, promise3b])
    .then(recordCardInfo(cardId, params))
    .then(() => {
        console.log('Record successfully added into dynamodb');
        console.log("response: " + JSON.stringify(response))
        callback(null, response);
    }).catch((err) => {
        console.log('DynamoDB error');
        console.error(err);
        errorResponse(err.message, params.awsRequestId, callback);
    });
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

function uploadImageToS3(cardId, fileName, imageBinary) {
    return new Promise((resolve, reject) => {
        console.log("uploading images to s3")
        buf = new Buffer(imageBinary.replace(/^data:image\/\w+;base64,/, ""),'base64')
        var params = {
            Bucket: bucket,
            Key: 'users/' + cardId + '/' + fileName, 
            Body: buf,
            ContentEncoding: 'base64',
            ContentType: 'image/png'
        };
        s3.putObject(params, function(err, data){
            if (err) { 
                console.log(err);
                console.log('Error uploading data: ', data); 
            } else {
                console.log('succesfully uploaded the image!');
            }
        });
    })
}

// Generate the VCF using 'vcf'
function generateVCard(params, vcfName){
    return new Promise((resolve, reject) => {
        vCard = vCard();

        //set properties
        vCard.firstName = params['first_name'];
        vCard.lastName = params['last_name'];
        vCard.organization = params['company'];
        // vCard.photo.attachFromUrl('https://avatars2.githubusercontent.com/u/5659221?v=3&s=460', 'JPEG');
        vCard.workPhone = params['phone_number'];
        vCard.title = params['role'];
        vCard.workUrl = params['website'];
        vCard.workEmail = params['email'];

        vCard.workAddress.label = 'Work Address';
        vCard.workAddress.street = params['address_street']
        vCard.workAddress.city = params['address_city'];
        vCard.workAddress.stateProvince = params['address_stateProvince'];
        vCard.workAddress.postalCode = params['address_postalCode'];
        vCard.workAddress.countryRegion = params['address_countryRegion'];

        console.log(vCard.getFormattedString());

        uploadToS3(vcfName, vCard.getFormattedString(), false);
    });
}

// Use handlebars to render the HTML from template; returns a Promise
function renderTemplate(params, readFileName, writeFileName, bucket) {
    return new Promise((resolve, reject) => {
        fs.readFileAsync(readFileName)
        .then((data) => {
            var source = data.toString('utf8'); // To convert the buffer stream into a string
            var template = handlebars.compile(source); // Handlebars at work
            var renderedTemplate = template(params);
            uploadToS3(writeFileName, renderedTemplate, true);
        });
    });
}

function generateQRCode(qrFileName, cardURL) {
    return new Promise((resolve, reject) => {
        var qr_stream = qr.image(cardURL, { ec_level: 'H' });
        uploadToS3(qrFileName, qr_stream, true);  
    });
}

// Put the user input into dynamoDB
function recordCardInfo(cardId, params) {
    console.log('Begin recording card info into dynamoDB')
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