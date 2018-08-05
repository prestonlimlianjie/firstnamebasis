# firstnamebasis

Firstnamebasis is a free digital business card creation and hosting service.

### For users

Create your own digital business card at https://firstnamebasis.app.

### For developers

To replicate the digital business card service, you need to use the following services:
1. AWS S3
2. AWS API Gateway and AWS Lambda

#### AWS S3

The main landing page as well as the individual business cards are hosted on S3 as static HTML pages.

The assets for the main landing page are found in the s3/public folder.
The assets for the individual business cards are found in the s3/assets folder.

#### AWS API Gateway/Lambda

Upon submission of the form on the main landing page, a POST API is called from the client browser and is sent to the AWS API Gateway. The lambda function is then called via the API Gateway to do the following:

* Create a new folder in the S3 bucket with a user-specific UUID to store all the relevant files
* Upload the user's profile picture and company logo into the abovementioned folder
* Render the user's individual business card HTML page
* Generate the user's VCF
* Generate the QR code pointing to the user's business card HTML page
* Upload all the files generated into the user's folder

The relevant code and assets for the lambda function are in the lambda/functions/createBusinessCard folder.


