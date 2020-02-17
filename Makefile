clean:
	@rm -rf build/
	@mkdir -p build

package: clean
	cd lambda/functions/createBusinessCard && npm install && zip -r ../../../build/lambda.zip .
	cp -r s3/ build/s3

upload:
	sed -i -e 's,{ENDPOINT},$(ENDPOINT),g' build/s3/public/js/main.js
	sed -i -e 's,{RECAPTCHA_SITE_KEY},$(RECAPTCHA_SITE_KEY),g' build/s3/index.html
	aws s3 cp --recursive build/s3 s3://$(BUCKET_URL)

taint:
	terraform taint aws_lambda_function.fnb_lambda
	terraform taint null_resource.upload
