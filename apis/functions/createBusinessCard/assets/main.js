function checkBox() {
	if (document.getElementById("slider").checked) {
		document.getElementById("profile-pic").style.display = "none";
		document.getElementById("qr-code").style.display = "block";
	} else {
		document.getElementById("profile-pic").style.display = "block";
		document.getElementById("qr-code").style.display = "none";
	}
}
