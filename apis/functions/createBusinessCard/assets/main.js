document.getElementById("share-button").addEventListener("click", toggleQRCode);

function toggleQRCode() {
	if (document.getElementById("profile-pic").style.display === "none") {
		document.getElementById("profile-pic").style.display = "block";
		document.getElementById("qr-code").style.display = "none";
	} else {
		document.getElementById("profile-pic").style.display = "none";
		document.getElementById("qr-code").style.display = "block";
	}
}