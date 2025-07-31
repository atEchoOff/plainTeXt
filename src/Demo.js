class Demo {
    // For use of the demo page
    constructor() {
        // Hide file button
        const fileButton = document.getElementById("file-button");
        fileButton.style.display = "none";
        console.log("Welcome to the demo!");

        // Get the demo page contents and render
        fetch("https://plaintext.bchristner.com/demo").then((response) => {
            response.text().then((content) => {
                // Window name
                const options = {name: "plainTeXt demo"};
                setFileContents(options, content);
            })
        });
    }
}

// Enable demo mode if window url contains bchristner
if (window.location.href.includes("bchristner")) {
    new Demo();
}