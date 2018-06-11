const handlebars = require('handlebars');
const randomBytes = require('crypto').randomBytes;

var Promise = require("bluebird");
var fs = Promise.promisifyAll(require("fs"));
var qr = require('qr-image');
var vCardJS = require('vcards-js');
const uuid = require('uuid/v4');

const AWS = require('aws-sdk');

// var credentials = new AWS.SharedIniFileCredentials({profile: 'digital-namecard'});
// AWS.config.credentials = credentials;
// AWS.config.update({region: 'ap-southeast-1'});

const ddb = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient());
const s3 = Promise.promisifyAll(new AWS.S3());

// Constants
// =========
const bucket = 'firstnamebasis.app';
const templateFile = './assets/index.html';
const bucketURL = 'http://firstnamebasis.app.s3-website-ap-southeast-1.amazonaws.com/';

// Test input for API Gateway
// ==========================
// var event = {
//     "body": JSON.stringify({
//         "full_name": "Preston Lim",
//         "first_name": "Preston",
//         "last_name": "Lim", 
//         "role": "Associate Software Engineer", 
//         "company": "Data Science Division, GovTech",
//         "profile_photo": "[blob]",
//         "company_logo": "[blob]",
//         "actions": {
//             "email": {
//                 "value": "preston@data.gov.sg"
//             },
//             "phone_number": {
//                 "value": "+65 9123 4567"
//             },
//             "website": {
//                 "value": "https://tech.gov.sg"
//             },
//             "address": {
//                 "address_street": "1 Fusionopolis, Sandcrawler, #09-01",
//                 "address_city": "Singapore",
//                 "address_stateProvince": "Singapore",
//                 "address_postalCode": "138577",
//                 "address_countryRegion": "Singapore"
//             }
//         }
//     })
// }

// Lambda function proper
// ======================
exports.handle = async (event, context, callback) => {
// main = async() => {
    try {
        console.log('start createBusinesCard...')
        console.log('event: ', event)

        // Generate UUIDs for eaach card and image group to prevent filename conflicts
        const cardId = uuid();
        var s3_file_path = 'users/' + cardId
        var params = parseRequestObject(JSON.parse(event.body));

        let files = await Promise.all([
                        generateHTML(params),
                        generateVCard(params),
                        generateQRCode(cardId)])

        let results = await Promise.all([
            uploadToS3( s3_file_path, 'index.html', 'html', files[0]), // files[0]: HTML
            uploadToS3( s3_file_path, 'user.vcf', 'vcf', files[1]), // files[1]: VCard
            uploadToS3( s3_file_path, 'qr.png', 'png', files[2]), // files[2]: QR Code
            uploadToS3( s3_file_path, 'profile_photo.png', 'png', params['profile_photo']), // profile_photo
            uploadToS3( s3_file_path, 'company_logo.png', 'png', params['company_logo']), // company_logo
        ]);

        let recordId = await saveUserToDb(cardId, params);

        respondSuccess(callback, cardId)

    } catch (err) {
        console.log("failed to createBusinessCard: ", err)
        respondError(callback, err)
    }
};

// main()



async function uploadToS3(s3_file_path, s3_file_name, file_type, file_body) {
    console.log("Start uploading file to s3: ", s3_file_path, "; ", s3_file_name, "; ", file_type)
    try {
        var params = {
            Bucket: bucket, 
            Key: s3_file_path + '/' + s3_file_name, 
            Body: file_body, 
        }; 
        if (file_type == "html") {
            params["ContentType"] = 'text/html'
        } else if (file_type == "png") {
            params["ContentEncoding"] = 'base64'
            params["ContentType"] = 'image/png'
        } else if (file_type == "vcf") {
            params["ContentType"] = 'text/x-vcard'
        }
        let uploadFile = await s3.uploadAsync(params);
        console.log("uploadToS3: Sucess!")
        return Promise.resolve(uploadFile)

    } catch (err) {
        console.log("Failed to upload file to s3: ", err)
        return Promise.reject(err)
    }
}

// Generate VCF file
async function generateVCard(params) {
    console.log("Start generating VCard...")
    try {
        vCard = vCardJS();
        //set properties
        vCard.firstName = params['first_name'];
        vCard.lastName = params['last_name'];
        vCard.organization = params['company'];
        vCard.photo.embedFromString(params['profile_photo'].toString('base64'), 'img/png');
        // vCard.logo.embedFromString(params['company_logo'].toString('base64'), 'img/png');
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
        console.log("generateVCard: Sucess!")
        return new Promise.resolve(vCard.getFormattedString());
    } catch (err) {
        console.log("Failed to generate VCard: ", err)
        return new Promise.reject(err)
    }
}

// Generate HTML file
async function generateHTML(params) {
    console.log("Start generating HTML...")
    try {
        var template_file = await fs.readFileAsync(templateFile);
        var template = template_file.toString('utf8');
        var templatin_engine = handlebars.compile(template);
        var rendered_template = templatin_engine(params);
        console.log("generateHTML: Sucess!")
        return new Promise.resolve(rendered_template);
    } catch (err) {
        console.log("Failed to generate HTML: ", err)
        return new Promise.reject(err)
    }
}

// Generate QR Code 
async function generateQRCode(cardId) {
    console.log("Start generating QR Code...")
    try {
        var cardURL = bucketURL + 'users/' + cardId + '/index.html'
        var qr_code = qr.image(cardURL, { ec_level: 'H' });
        console.log("generateQRCode: Sucess!")
        return Promise.resolve(qr_code)
    } catch (err) {
        console.log("Failed to generate QR Code: ", err)
        return new Promise.reject(err)
    }
}

// Put the user input into dynamoDB
async function saveUserToDb(cardId, params) {
    console.log('Start recording card info into dynamoDB: ', cardId)
    try {
        delete params.profile_photo
        delete params.company_logo
        let saveUser = await ddb.putAsync({
            TableName: 'DigitalBusinessCards',
            Item: {
                CardId: cardId,
                Info: params,
                RequestTime: new Date().toISOString(),
            },
        })
        console.log("saveUserToDb: Sucess!")
        return Promise.resolve(saveUser)
    } catch (err) {
        console.log("Failed to save user into dynamodb: ", err)
        return Promise.reject(err)
    };
};

function processImageBinary(image_binary) {
    return new Buffer(image_binary.replace(/^data:image\/\w+;base64,/, ""),'base64')
}

function parseRequestObject(request_object) {
    return {
        'full_name': request_object.first_name + " " + request_object.last_name,
        'first_name': request_object.first_name,
        'last_name': request_object.last_name, 
        'role': request_object.role, 
        'company': request_object.company,
        'email': request_object.actions.email.value,
        'phone_number': request_object.actions.phone_number.value,
        'website': request_object.actions.website.value,
        'address_street': request_object.actions.address.address_street,
        'address_city': request_object.actions.address.address_city,
        'address_stateProvince': request_object.actions.address.address_stateProvince,
        'address_postalCode': request_object.actions.address.address_postalCode,
        'address_countryRegion': request_object.actions.address.address_countryRegion,
        'address': request_object.actions.address.address_street + ", " + request_object.actions.address.address_city + ", " + request_object.actions.address.address_stateProvince + ", " + request_object.actions.address.address_postalCode + ", " + request_object.actions.address.address_countryRegion,
        'profile_photo': processImageBinary(request_object.profile_photo),
        'company_logo': processImageBinary(request_object.company_logo),
        'github': request_object.github,
        'linkedin': request_object.linkedin,
        'facebook': request_object.facebook,
        'medium': request_object.medium,
        'instagram': request_object.instagram,
        'additional_info': additionalInfoExists(request_object.github, request_object.linkedin, request_object.facebook, request_object.medium, request_object.instagram)
    };
}

function additionalInfoExists(github, linkedin, facebook, medium, instagram) {
    return (Boolean(github) || Boolean(linkedin) || Boolean(facebook) || Boolean(medium) || Boolean(instagram))
}

// Return a helpful error message
function respondError(callback, cardId, errorMessage) {
    callback(null, {
        statusCode: 500,
        headers: {
            "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS 
        },
        body: JSON.stringify({
            error: errorMessage,
            path: bucketURL + 'users/' + cardId + '/index.html',
        })
    });
};

function respondSuccess(callback, cardId) {
    callback(null, {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS 
        },
        body: JSON.stringify({
            path: bucketURL + 'users/' + cardId + '/index.html',
        })
    })
};