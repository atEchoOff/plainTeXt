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

function extractBraceText(cmd, inputText) {
    // Find \cmd{content} in inputText, return content. 
    let braceLevel = 0;
    let startIndex = inputText.indexOf(`\\${cmd}{`);

    if (startIndex === -1) {
        return null;
    }

    let endIndex = -1;
    const contentStartIndex = startIndex + `\\${cmd}{`.length;

    for (let i = contentStartIndex; i < inputText.length; i++) {
        if (inputText[i] === '{') {
            braceLevel++;
        } else if (inputText[i] === '}') {
            if (braceLevel === 0) {
                // This is the final closing brace for the caption
                endIndex = i;
                break;
            } else {
                braceLevel--;
            }
        }
    }

    return inputText.substring(contentStartIndex, endIndex);
}

function toMathNotation(cellText) {
    // Convert cellText to a math block that can appear in a figure/caption/table
    if (cellText == "") {
        return "";
    }

    if (cellText.startsWith("\\text{") && cellText.endsWith("}")) {
        const innerTextLiterally = cellText.substring(6, cellText.length - 1);
        if (!innerTextLiterally.includes("}")) {
            // This is just text, so we dont need $\text{...}$ around it.
            return innerTextLiterally;
        }
    }

    return `$${cellText}$`;
}

function convertToLatexTable(inputText) {
    // --- Step 0: Find and extract caption ---
    let captionText;
    let labelText;
    let processedInput = inputText;
    let endIndex = inputText.indexOf("\\end{table}");

    if (endIndex !== -1) {
        // There is some stuff after the table. Check for label and caption
        let afterText = inputText.substring(inputText.lastIndexOf("\\end{table}") + 11);
        labelText = extractBraceText("labell", afterText);
        if (labelText) {
            afterText = afterText.replace(`\\labell{${labelText}}`, "");
        }

        captionText = afterText;
    }

    const tableContentMatch = processedInput.trim().match(/\\begin\{table\}([\s\S]*?)\\end\{table\}/);

    let content = tableContentMatch[1];
    const rawRows = content.split('\\\\').filter(row => row.trim() !== '');
    
    const numRows = rawRows.length;
    const cellRows = rawRows.map(rowStr => rowStr.split('&').map(c => c.trim()));

    // --- Step 1: Calculate column count based on the first row ---
    let maxCols = 0;
    cellRows[0].forEach(cell => {
        const match = cell.match(/\\mergeright\[(\d+)\]/);
        maxCols += match ? parseInt(match[1]) : 1;
    });

    // --- Step 2: Create a model grid and populate it, marking merged cells ---
    const modelGrid = Array(numRows).fill(0).map(() => Array(maxCols).fill(null));
    for (let r = 0; r < numRows; r++) {
        let c = 0; 
        for (const cellContent of cellRows[r]) {
            while (c < maxCols && modelGrid[r][c] !== null) c++;
            if (c >= maxCols) continue;

            modelGrid[r][c] = cellContent;

            const rightMatch = cellContent.match(/\\mergeright\[(\d+)\]/);
            if (rightMatch) {
                const n = parseInt(rightMatch[1]);
                const hasNoBottomBorder = cellContent.includes('\\nobottomborder');
                for (let i = 1; i < n; i++) {
                    if (c + i < maxCols) modelGrid[r][c + i] = hasNoBottomBorder ? 'BLOCKED_H_NOBOTTOM' : 'BLOCKED_H';
                }
            }

            const downMatch = cellContent.match(/\\mergelower\[(\d+)\]/);
            if (downMatch) {
                const n = parseInt(downMatch[1]);
                const hasNoRightBorder = cellContent.includes('\\norightborder');
                for (let i = 1; i < n; i++) {
                    if (r + i < numRows) modelGrid[r + i][c] = hasNoRightBorder ? 'BLOCKED_V_NORIGHT' : 'BLOCKED_V';
                }
            }
            c++;
        }
    }

    // --- Step 3: Generate the final LaTeX cell content from the model grid ---
    const outputRows = [];
    for (let r = 0; r < numRows; r++) {
        const rowCells = [];
        for (let c = 0; c < maxCols; c++) {
            const cell = modelGrid[r][c];
            if (cell === 'BLOCKED_H' || cell === 'BLOCKED_H_NOBOTTOM') continue;
            if (cell === 'BLOCKED_V') {
                rowCells.push('');
                continue;
            }
            
            const needsNoLeftBorder = (c > 0 && modelGrid[r][c-1] === 'BLOCKED_V_NORIGHT');

            if (cell === 'BLOCKED_V_NORIGHT') {
                // This cell is blocked by a multirow that needs no right border.
                // Render it as an empty cell with no right border, which means the cell
                // to its right will correctly have no left border.
                rowCells.push('\\multicolumn{1}{|c}{}');
                continue;
            }

            let cellContent = cell === null ? '' : cell;
            const selfHasNoRightBorder = cellContent.includes('\\norightborder');
            let cleanContent = cellContent.replace(/\\no(right|bottom)border/g, '').trim();

            const rightMatch = cleanContent.match(/\\mergeright\[(\d+)\]\{(.*)\}/s);
            const downMatch = cleanContent.match(/\\mergelower\[(\d+)\]\{(.*)\}/s);

            let finalContent = cleanContent;
            let isMultiRow = false;
            let multiRowSpan = 1;

            if (rightMatch) {
                finalContent = rightMatch[2];
            } else if (downMatch) {
                finalContent = downMatch[2];
                isMultiRow = true;
                multiRowSpan = parseInt(downMatch[1]);
            }
            
            let contentInMath = toMathNotation(finalContent);

            const multiRowContent = `\\multirow{${multiRowSpan}}{*}{${contentInMath}}`;
            
            const leftBorder = needsNoLeftBorder ? 'c' : '|c';
            const rightBorder = selfHasNoRightBorder ? '' : '|';
            const colSpec = `${leftBorder}${rightBorder}`;

            if (rightMatch) {
                const colSpan = parseInt(rightMatch[1]);
                rowCells.push(`\\multicolumn{${colSpan}}{${colSpec}}{${contentInMath}}`);
            } else if (isMultiRow) {
                if (needsNoLeftBorder || selfHasNoRightBorder) {
                    rowCells.push(`\\multicolumn{1}{${colSpec}}{${multiRowContent}}`);
                } else {
                    rowCells.push(multiRowContent);
                }
            }
            else { // Normal cell
                    if (needsNoLeftBorder || selfHasNoRightBorder) {
                    rowCells.push(`\\multicolumn{1}{${colSpec}}{${contentInMath}}`);
                    } else {
                    rowCells.push(contentInMath);
                    }
            }
        }
        outputRows.push(rowCells.join(' & '));
    }

    // --- Step 4: Assemble the final table string with intelligent horizontal lines ---
    const columnFormat = `{|${'C|'.repeat(maxCols)}}`;
    let latexOutput = `\\begin{tabulary}{\\textwidth}{${columnFormat}}\n`;
    latexOutput += `\\hline\n`; // Top border

    for (let r = 0; r < numRows; r++) {
        latexOutput += outputRows[r];
        latexOutput += ' \\\\';

        if (r < numRows - 1) {
            const ranges = [];
            let currentRange = null;

            for (let c = 0; c < maxCols; c++) {
                const isBlockedBelow = modelGrid[r + 1] && (modelGrid[r + 1][c] === 'BLOCKED_V' || modelGrid[r + 1][c] === 'BLOCKED_V_NORIGHT');
                const hasNoBottomBorder = modelGrid[r][c] && modelGrid[r][c].includes('\\nobottomborder');
                const isBlockedHorizNoBottom = modelGrid[r][c] === 'BLOCKED_H_NOBOTTOM';
                
                if (!isBlockedBelow && !hasNoBottomBorder && !isBlockedHorizNoBottom) {
                    if (currentRange === null) currentRange = { start: c + 1, end: c + 1 };
                    else currentRange.end = c + 1;
                } else {
                    if (currentRange !== null) ranges.push(currentRange);
                    currentRange = null;
                }
            }
            if (currentRange !== null) ranges.push(currentRange);

            if (ranges.length === 1 && ranges[0].start === 1 && ranges[0].end === maxCols) {
                latexOutput += '\n\\hline\n';
            } else if (ranges.length > 0) {
                const clines = ranges.map(range => `\\cline{${range.start}-${range.end}}`).join('');
                latexOutput += `\n${clines}\n`;
            } else {
                latexOutput += '\n';
            }
        } else {
            latexOutput += '\n\\hline\n';
        }
    }
    latexOutput += `\\end{tabulary}`;
    
    // --- Step 5: Wrap in table environment and add caption ---
    let finalOutput = `\\begin{table}[h!]\n\\centering\n`;
    finalOutput += latexOutput;
    if (captionText) {
        finalOutput += `\n\\caption{${toMathNotation(captionText)}}`;
    }

    if (labelText) {
        finalOutput += `\n\\label{${labelText}}`;
    }

    finalOutput += `\n\\end{table}`;

    return finalOutput;
}

function convertToLatexFigure(inputText) {
    let afterFigure = inputText.substring(inputText.lastIndexOf("\\end{figure}") + 12);
    let labelText = extractBraceText("labell", afterFigure);

    if (labelText) {
        afterFigure = afterFigure.replace(`\\labell{${labelText}}`, "");
    }

    let captionText = afterFigure;

    // --- Step 2: Extract the content from within the figure environment ---
    const figureContentMatch = inputText.match(/\\begin\{figure\}([\s\S]*?)\\end\{figure\}/);

    const figureContent = figureContentMatch[1];

    // --- Step 3: Process each row and cell to generate subfloats ---
    const rows = figureContent.split('\\\\');
    const cellsByRow = rows.map(row => row.split('&').filter(cell => cell.trim()));
    
    // Find the widest row in terms of number of cells to determine the base image size
    const maxImagesInRow = Math.max(0, ...cellsByRow.map(row => row.length));

    if (maxImagesInRow === 0) {
            console.error("No valid subfigure cells found.");
        return null;
    }

    // Calculate a dynamic width for a single-column image
    const baseWidth = 1 / maxImagesInRow;

    const subfloatRowStrings = cellsByRow.map(row => {
        return row.map(cell => {
            const trimmedCell = cell.trim();
            if (!trimmedCell) return null;

            let innerContent = trimmedCell;
            let colspan = 1;

            const mergeRightRegex = /\\mergeright\[(\d+)\]\{(.*)\}/s;
            const mergeRightMatch = trimmedCell.match(mergeRightRegex);

            if (mergeRightMatch) {
                colspan = parseInt(mergeRightMatch[1]);
                innerContent = mergeRightMatch[2].trim();
            }
            
            const embedMatch = innerContent.match(/\\embed\{image\}\[(\d+)\]/);
            if (!embedMatch) return null;

            const imageId = embedMatch[1];
            const embedCommand = embedMatch[0];
            let finalSubCaption = '';
            let subLabel = '';

            const captionAndLabelContent = innerContent.replace(embedCommand, '').trim();

            if (captionAndLabelContent) {
                const subLabelContent = extractBraceText('labell', captionAndLabelContent);
                if (subLabelContent !== null) {
                    subLabel = subLabelContent;
                    const subLabelCommand = `\\labell{${subLabelContent}}`;
                    finalSubCaption = captionAndLabelContent.replace(subLabelCommand, '').trim();
                } else {
                    finalSubCaption = captionAndLabelContent;
                }
            }

            const imageWidth = Math.min(baseWidth, 0.95).toFixed(3);
            const captionPart = finalSubCaption ? `\\centering ${toMathNotation(finalSubCaption)}` : '';
            const labelPart = subLabel ? `\\label{${subLabel}}` : '';

            return `    \\subfloat[${captionPart}]{{\\includegraphics[width=${imageWidth}\\textwidth]{${imageId}.png} }${labelPart}}`;

        }).filter(Boolean).join('%\n');
    }).filter(rowString => rowString);


    // --- Step 4: Assemble the final output ---
    let finalOutput = `\\begin{figure}%\n    \\centering\n`;
    finalOutput += subfloatRowStrings.join('\\\\\n');
    
    if (captionText) {
        finalOutput += `%\n    \\caption{${toMathNotation(captionText)}}`;
    }
    if (labelText) {
        finalOutput += `%\n    \\label{${labelText}}`;
    }
    finalOutput += `%\n\\end{figure}`;

    return finalOutput;
}

function latext(returnLaTeX) {
    // Convert document text to latex for pasting into overleaf
    // If returnLaTeX === true, return docString and bibtex instead of copying
    let lines = getDocumentText().split("\n");
    let output = []; // Array of each line
    let bibtex = ""; // Save our bibtex file

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
        } else if (line.startsWith("\\bibtex")) {
            // This is a bibtex entry. We may add it to the bibtex.
            const entry = decodeURIComponent(line.substring(line.indexOf("{") + 1, line.lastIndexOf("}")));
            bibtex += entry + "\n";
        } else if (line.startsWith("$\\begin{table}")) {
            // This is a table. We have a function for that!
            output.push(convertToLatexTable(line.substring(1, line.length - 1)));
        } else if (line.startsWith("$\\begin{figure}")) {
            output.push(convertToLatexFigure(line.substring(1, line.length - 1)));
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
\\usepackage{tabulary}
\\usepackage{subfig}
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

\\bibliographystyle{plain}
\\bibliography{references}
\\end{document}
    `;

    // copy to clipboard
    if (returnLaTeX === true) { // Objects are true...
        return [docString, bibtex];
    } else {
        navigator.clipboard.writeText(docString).then(() => {}, () => {});
    }
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
        imageSrc = JSON.parse(imageData);
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

    contents += "||" + JSON.stringify(imageSrc);

    const writable = await fileHandle.createWritable();
    await writable.write(contents);
    await writable.close();

    console.log("Saved!");
}

async function createZipDataURI() {
    const zip = new JSZip();

    // Add main.tex file and references
    const [docString, bibtex] = latext(true);
    zip.file('main.tex', docString);
    zip.file('references.bib', bibtex);

    // Loop through the imageSrc dictionary to add images
    for (const id in imageSrc) {
        const imageData = imageSrc[id];

        // Data URIs are in the format "data:[<mediatype>][;base64],<data>"
        // We need to extract just the base64 part for JSZip
        const base64Data = imageData.split(',')[1];
        
        // Add the image file to the zip, specifying its name and base64 content
        zip.file(`${id}.png`, base64Data, { base64: true });
    }

    // Generate the complete zip file as a base64 string
    const zipContent = await zip.generateAsync({ type: 'base64' });

    // Return the full data URI for the zip file
    return `data:application/zip;base64,${zipContent}`;
}

function toOverleaf() {
    // Create a form with textarea containing the latex. Then pass to overleaf!
    createZipDataURI().then((zipUri) => {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://www.overleaf.com/docs';
        form.target = '_blank'; // Open in new tab
        form.style.display = 'none';

        const input = document.createElement('textarea');
        input.name = 'snip_uri';
        input.value = zipUri;
        form.appendChild(input);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
    })
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