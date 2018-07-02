function GetURLParameter(sParam) {
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}

/**
 * Determine the mobile operating system.
 * This function returns one of 'iOS', 'Android', 'Windows Phone', or 'unknown'.
 *
 * @returns {String}
 */
function getMobileOperatingSystem() {
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;
      // Windows Phone must come first because its UA also contains "Android"
    if (/windows phone/i.test(userAgent)) {
        return "Windows Phone";
    }
    if (/android/i.test(userAgent)) {
        return "Android";
    }
    // iOS detection from: http://stackoverflow.com/a/9039885/177710
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return "iOS";
    }
    return "unknown";
}


$(document).ready(function() {
    let id = GetURLParameter("id");
    $("#link-display").text("https://firstnamebasis.app/users/" + id)

    var os = getMobileOperatingSystem();
    if (os == "iOS"){
        $("#ios-tip").removeClass("d-none")
        $("#ios-btn").removeClass("active").addClass("disabled")
    } else if ( os == "Android") {
        $('#android-tip').removeClass("d-none")
        $("#android-btn").removeClass("active").addClass("disabled")
    } else if ( os == "Windows Phone") {
        $('#windows-tip').removeClass("d-none")
        $("#windows-btn").removeClass("active").addClass("disabled")
    }
    
    var toggle_buttons = document.querySelectorAll('button');
    console.log(toggle_buttons)
    // open the content element when clicking on the buttonsItems
    toggle_buttons.forEach(function (item, idx) {
        item.addEventListener('click', function () {
            // self._showContent(idx);
            console.log(this)
        });
    });


})