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

function latext(returnLaTeX) {
    // Convert document text to latex for pasting into overleaf
    // If returnLaTeX === true, return string instead of copying
    let lines = getDocumentText().split("\n");
    let output = []; // Array of each line
    for (var line of lines) {
        // Conditionally handle each line
        if (line.startsWith("\\theorem{")
         || line.startsWith("\\definition{")
         || line.startsWith("\\proposition{")
         || line.startsWith("\\corollary{")
         || line.startsWith("\\lemma{")
         || line.startsWith("\\remark{")) {
            // This is a cmd=theorem/definition/proposition/corollary/lemma/remark line. It is of the form:
            // \cmd{Label}Theorem text
            // We want it to be in the form:
            // \begin{cmd}\label{cmd:label} Theorem text\end{cmd}
            // \begin{proof} (if theorem, lemma, or corollary)

            let cmd = line.substring(1, line.indexOf("{"));
            let theoremName = line.substring(line.indexOf("{") + 1, line.indexOf("}"));
            let theoremText = line.substring(line.indexOf("}") + 1);

            output.push("\\begin{" + cmd + "}");
            output.push("\\label{" + cmd + ":" + theoremName + "}");
            output.push(theoremText);
            output.push("\\end{" + cmd + "}");
            if (cmd === "theorem" || cmd === "lemma") {
                output.push("\\begin{proof}");
            }
        } else if (line.startsWith("\\qed{")) {
            // This is a \qed, we want to just replace this with \end{proof}
            output.push("\\end{proof}");
        } else if (line.startsWith("\\includegraphics")) {
            // The image is of the form:
            // \includegraphics{id encoded(caption)}
            // decoded(caption) is of the form:
            // \label{labelname} captionText
            // OR
            // captionText
            let p17 = line.substring(17, line.lastIndexOf("}"));
            let id = p17.substring(0, p17.indexOf(" "));
            let caption = decodeURIComponent(p17.substring(p17.indexOf(" ") + 1));
            let label = null;
            if (caption.startsWith("\\label")) {
                label = caption.substring(7, caption.indexOf("}"));
                caption = caption.substring(label.length + 8);
            }

            output.push("\\begin{figure}[h]");
            output.push("\\centering");
            output.push("\\includegraphics[width=0.8\\textwidth]{" + id + "}");
            output.push("\\caption{" + caption + "}");
            if (label) {
                output.push("\\label{" + label + "}");
            }
            output.push("\\end{figure}");
        } else if (line.startsWith("\\begin{align*}")
                || line.startsWith("\\begin{pmatrix}")
                || line.startsWith("\\begin{cases}")
                || line.startsWith("\\begin{bmatrix}")
                || line.startsWith("\\begin{Bmatrix}")
                || line.startsWith("\\begin{vmatrix}")
                || line.startsWith("\\begin{Vmatrix}")
                || line.startsWith("\\begin{matrix}")) {
            
            // Add some newlines after each linebreak to made it more readable
            output.push(line.replaceAll("\\\\", "\\\\\n"));
        } else if (line.startsWith("\\python") 
                || line.startsWith("\\javascript") 
                || line.startsWith("\\java")) {
            // This is code
            const language = line.substring(1, line.indexOf("{"));
            const code = line.substring(line.indexOf("{") + 1, line.lastIndexOf("}"));
            output.push("\\begin{" + language + "}");
            output.push(decodeURIComponent(code));
            output.push("\\end{" + language + "}");
        } else {
            output.push(line);
        }
    }

    let docString = output.join("\n");

    // Replace all \tag{content} with \tag{$content$}
    const refregex = /\\tag\{((?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*\})*)\}/g
    docString = docString.replaceAll(refregex, "\\tag{$$$1$$}")
                         .replaceAll("\u200b", "");

    // Add header and footer
    docString = `
\\documentclass[10pt]{report}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amsfonts,amsthm,mathbbol,bm}
\\usepackage{booktabs, multirow}
\\usepackage{mathtools}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{soul}
\\usepackage{xcolor,colortbl}
\\usepackage{amssymb}
\\usepackage{changepage,threeparttable}
\\usepackage{mathabx,epsfig}
\\usepackage{color, listings}
\\lstset{
    basicstyle=\\ttfamily,
    escapechar=\\%
}
\\usepackage{geometry}[margin=1in]

\\DeclareSymbolFontAlphabet{\\mathbb}{AMSb}
\\DeclareSymbolFontAlphabet{\\mathbbm}{bbold}

\\def\\acts{\\mathrel{\\reflectbox{$\\righttoleftarrow$}}}

\\newcommand{\\ub}[2]{\\underbrace{#1}_{#2}}

\\newcommand{\\vecf}[1]{\\bm{#1}}
\\newcommand{\\vect}[1]{\\bm{\\mathsf{#1}}}
\\newcommand{\\fnt}[1]{\\bm{\\mathsf{#1}}}

\\DeclareMathOperator{\\rank}{rank}
\\DeclareMathOperator{\\im}{im}
\\DeclareMathOperator{\\BV}{BV}
\\DeclareMathOperator{\\Var}{Var}

\\usepackage{amsfonts,amssymb,amsthm}
\\renewcommand{\\aligned}[1]{&#1}
\\newcommand{\\labell}[1]{\\addtocounter{equation}{1}\\tag{\\theequation}\\label{#1}}
\\DeclareMathOperator{\\diag}{diag}
\\DeclareMathOperator{\\clip}{clip}
\\newtheorem{theorem}{Theorem}[section]
\\theoremstyle{definition}\\newtheorem{definition}{Definition}[section]
\\newtheorem{proposition}{Proposition}[section]
\\newtheorem{corollary}{Corollary}[section]
\\newtheorem{lemma}{Lemma}[section]
\\newtheorem{remark}{Remark}[section]

\\definecolor{dkgreen}{rgb}{0,0.6,0}
\\definecolor{gray}{rgb}{0.5,0.5,0.5}
\\definecolor{mauve}{rgb}{0.58,0,0.82}

\\lstset{frame=tb,
  aboveskip=3mm,
  belowskip=3mm,
  showstringspaces=false,
  columns=flexible,
  basicstyle={\\small\\ttfamily},
  numbers=none,
  numberstyle=\\tiny\\color{gray},
  keywordstyle=\\color{blue},
  commentstyle=\\color{dkgreen},
  stringstyle=\\color{mauve},
  breaklines=true,
  breakatwhitespace=true,
  tabsize=3
}

\\lstnewenvironment{python}[1][]{%
  \\lstset{language=Python, #1}%
}{}

\\lstnewenvironment{java}[1][]{%
  \\lstset{language=Java, #1}%
}{}

\\lstnewenvironment{javascript}[1][]{%
  \\lstset{language=Java, #1} % at this time, JS is not supported by lstlistings
}{}

\\begin{document}

    ` + docString + `

\\end{document}
    `;

    // copy to clipboard
    if (returnLaTeX === true) { // Objects are true...
        return docString;
    } else {
        navigator.clipboard.writeText(docString).then(() => {}, () => {});
    }
}

let openingFile = false; // If we are opening a file, trigger a scroll down before enabling virtual scroll

async function openFile(create) {
    openingFile = true;

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
                "src": image.src
            }

            index++;
        }
    }

    contents += "||" + JSON.stringify(json);

    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();

    console.log("Saved!");
}

function toOverleaf() {
    // Create a form with textarea containing the latex. Then pass to overleaf!
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.overleaf.com/docs';
    form.target = '_blank'; // Open in new tab
    form.style.display = 'none';

    const input = document.createElement('textarea');
    input.name = 'snip';
    input.value = latext(true); // Return latex rather than copying
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

let button = document.getElementById("open-button");
button.addEventListener("click", () => openFile());

let overleaf = document.getElementById("overleaf");

overleaf.addEventListener('click', toOverleaf);

let copyButton = document.getElementById("copy-latex");

// Copy latex when clicking this button
copyButton.addEventListener('click', latext);

let saveButton = document.getElementById("save-button");

saveButton.addEventListener('click', saveFile);

let newButton = document.getElementById("new-button");

newButton.addEventListener('click', () => {
    // Open a new tab/window
    window.open(window.location.href, '_blank').focus();
})

// Occasionally save the file if applicable
window.setInterval(function() {
    if (fileHandle) {
        saveFile();
    }
}, 15000);