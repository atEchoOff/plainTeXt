// File handler, super OS dependent and works on literally one browser
let fileHandle;

function triggerPasteEvent(contents) {
    // Trigger paste event for file contents
    // This is definitely not hacky and is very smart hear me out
    // This will call the handlePaste function in mathquill.js
    // That way we dont need to code it twice :)

    // Paste contents
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', contents);
  
    // create paste event with clipboard data
    const pasteEvent = new ClipboardEvent('paste', {
        isTrusted: true,
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
    });
  
    // send event
    editorElement.firstChild.dispatchEvent(pasteEvent);
}

function getDocumentText() {
    // Simulate Ctrl+A Ctrl+C
    const doc = editor.state.doc;

    return mathQuillPlugin.props.clipboardTextSerializer(doc.slice(0));
}

function latext() {
    // Convert document text to latex for pasting into overleaf
    let lines = getDocumentText().split("\n");
    let output = []; // Array of each line
    for (var line of lines) {
        // Conditionally handle each line
        if (line.startsWith("\\theorem{")) {
            // This is a theorem line. It is of the form:
            // \theorem{Label}Theorem text
            // We want it to be in the form:
            // \begin{theorem}\label{label} Theorem text\end{theorem}
            // \begin{proof}

            let theoremName = line.substring(line.indexOf("{") + 1, line.indexOf("}"));
            let theoremText = line.substring(line.indexOf("}") + 1);

            output.push("\\begin{theorem} \\label{" + theoremName + "} " + theoremText + "\\end{theorem}");
            output.push("\\begin{proof}");
        } else if (line.startsWith("\\qed{")) {
            // This is a \qed, we want to just replace this with \end{proof}
            output.push("\\end{proof}");
        } else {
            output.push(line);
        }
    }

    // copy to clipboard
    navigator.clipboard.writeText(output.join("\n")).then(() => {}, () => {});
}

async function openFile(create) {
    const options = {
        startIn: 'documents',
        types: [
        ],
    };
    
    // getting fileHandle differs on browsers
    if (create) {
        fileHandle = await window.showSaveFilePicker(options);
    } else {
        [fileHandle] = await window.showOpenFilePicker(options);
    }

    // Get file and contents
    const file = await fileHandle.getFile();
    let contents = await file.text();
    if (contents.includes("||")) {
        // Load previous image data from saved file
        // it will all go away once original paste event completes
        imageData = contents.substring(contents.lastIndexOf("||") + 2);
        contents = contents.substring(0, contents.lastIndexOf("||"));
        imageData = JSON.parse(imageData);
    }
    document.title = file.name; // change window name to file title

    // Simulate Ctrl+A Ctrl+V
    // Create a new transaction
    let tr = editor.state.tr;
    
    // Delete all content in the document
    tr.delete(0, editor.state.doc.content.size);
    editor.dispatch(tr);

    triggerPasteEvent(contents);
}

async function saveFile() {
    // Get document contents and save
    let contents = getDocumentText();

    // Loop through images and save their contents at the bottom of file
    let images = document.getElementsByTagName("IMG");
    let json = {};
    let index = 0;
    for (var image of images) {
        if (image.classList.contains("imagePluginImg")) { // Only count image plugin images
            json[index.toString()] = {
                "src": image.src,
                "title": image.nextSibling.innerText
            }

            index++;
        }
    }

    contents += "||" + JSON.stringify(json);

    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
}

let button = document.getElementById("open-button");
button.addEventListener("click", () => openFile());

// Occasionally save the file if applicable
window.setInterval(function() {
    if (fileHandle) {
        saveFile();
        console.log("Saved!");
    }
}, 15000);