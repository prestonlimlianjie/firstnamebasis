// Helper to display image after selection
function readURL(input) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();

    reader.onload = function (e) {
      $('#photo-display')
        .attr('src', e.target.result)
        .width(150)
        .height(200)
        .show();
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function sendPostRequest(body) {
  console.log("sending data to api endpoint")
  var endpoint = 'https://30nl04a0ki.execute-api.ap-southeast-1.amazonaws.com/v1/create'; 

  return $.ajax({
            type: 'POST',
            url: endpoint,
            data: body,
            dataType: 'json',
            success: callback
          });

}

$(document).ready(function() {



  $("form#signupForm").submit(function(e){
    e.preventDefault();

    var getFormData = Promise.resolve($("#signupForm").serializeJSON())
    var getImageBlob = getBase64($("input#photo.form-control-file")[0].files[0])
    

    var formPostObject = Promise.all([getFormData, getImageBlob]).then((values) => {
      var postObject = values[0]
      postObject.photo = values[1]
      return Promise.resolve(postObject)
    })

    var postToEndpoint = formPostObject.then(function(postObject) {
      // return sendPostRequest(postObject)
      var endpoint = 'https://30nl04a0ki.execute-api.ap-southeast-1.amazonaws.com/v1/create'; 

      $.ajax({
        url: endpoint,
        type: "POST",
        data: postObject,
        success: function (result) {
            switch (result) {
                case true:
                    console.log(result);
                    break;
                default:
                    console.log(result);
            }
        },
        error: function (xhr, ajaxOptions, thrownError) {
          alert(xhr.status);
        }
      });

      // $.ajax({
      //   type: 'POST',
      //   url: endpoint,
      //   data: postObject,
      //   dataType: 'json',
      //   success: function(data) {
      //     console.log('success', data) 
      //   },
      //   error: function(xhr) {
      //     console.log('error', xhr);
      //   }
      // });
    })

    // postToEndpoint
    // .done(function(data) {
    //   console.log('common callback', data);
    // })
    // .fail(function(xhr) {
    //   console.log('error common back', xhr);
    // });

    // $.post($(this).attr("action"), formData, function(data) {
    //   alert(data);
    // });
  });



  $('#form-add-card').on('click', function(event) {
    $('#callToActionContainer').append(
      `<div class="card col-sm-6 p-1">
        <div class="card-body">
          <div class="form-group">
           <label for="exampleFormControlInput2">Email address</label>
           <input class="form-control" id="exampleFormControlInput2" type="email" placeholder="name@example.com">
           </div>
          <div class="form-group">
            <label for="exampleFormControlSelect2">Example select</label>
            <select class="form-control" id="exampleFormControlSelect2">
              <option>1</option>
              <option>2</option>
              <option>3</option>
              <option>4</option>
            </select>
          </div>
        <div class="form-group">
          <label for="exampleFormControlTextarea2">Example textarea</label>
          <textarea class="form-control" id="exampleFormControlTextarea2" rows="3"></textarea>
        </div>
      </div>
    </div>`);
  });

});
