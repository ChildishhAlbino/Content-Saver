document.addEventListener(
  "DOMContentLoaded",
  () => {
    console.log("SCRIPT ACTIVE");

    const bg = chrome.extension.getBackgroundPage();
    const blobs = bg.blobs;
    console.log(blobs);

    if (blobs) {
      blobs.forEach((blob) => {
        let blobURL = URL.createObjectURL(blob);
        console.log(blobURL);
        var a = document.createElement("a");
        a.download = "download";
        a.href = blobURL;
        a.textContent = "Click here to download!";
        document.body.appendChild(a);
      });
    }
  },
  false
);
