// Button handling is completely isolated so plainTeXt can be used for purposes other than as a document writer down the line

class ButtonManager {
    constructor() {
        // Get buttons
        this.fileButton = document.getElementById("file-button");
        this.button = document.getElementById("open-button");
        this.toPDFButton = document.getElementById("PDF-button");
        this.toZipButton = document.getElementById("zip-button");
        this.copyButton = document.getElementById("copy-latex");
        this.saveButton = document.getElementById("save-button");
        this.newButton = document.getElementById("new-button");

        this.commandDropDown = document.getElementById("command-drop-down");
        this.commandButtons = document.getElementsByClassName("command-button");

        this.plainTeXtGitHub = document.getElementById("plainTeXt-github");
        this.plainTeXtDownload = document.getElementById("plainTeXt-download");
        this.mqeditorGitHub = document.getElementById("mqeditor-github");
        this.darkModeButton = document.getElementById("dark-mode-button");

        this.mathButton = document.getElementById("create-math-button");
        this.screenshotMathButton = document.getElementById("screenshot-math");

        this.alignButton = document.getElementById("create-align");
        this.tableButton = document.getElementById("create-table");
        this.figureButton = document.getElementById("create-figure");

        this.createColumnButton = document.getElementById("create-column");
        this.createRowButton = document.getElementById("create-row");
        this.mergeRightButton = document.getElementById("merge-right");
        this.mergeDownButton = document.getElementById("merge-down");
        this.noBottomBorderButton = document.getElementById("nbb");
        this.noRightBorderButton = document.getElementById("nrb");

        this.loadPyScriptButton = document.getElementById("load-pyscript");
        this.clearSympyButton = document.getElementById("clear-sympy");
        this.evalSympyButton = document.getElementById("eval-sympy");

        // Add event listeners
        //   v the ORIGINAL button
        this.button.addEventListener("click", () => {openFile()});
        this.toPDFButton.addEventListener('click', toPDF);
        this.toZipButton.addEventListener("click", toZip);
        this.copyButton.addEventListener('click', latext);
        this.saveButton.addEventListener('click', saveFile);
        this.newButton.addEventListener('click', () => {
            // Open a new tab/window
            window.open(window.location.href, '_blank').focus();
        });

        this.plainTeXtGitHub.addEventListener("click", () => {
            window.open("https://github.com/atEchoOff/plainTeXt", '_blank').focus();
        });
        this.plainTeXtDownload.addEventListener("click", () => {
            window.open("https://github.com/atEchoOff/plainTeXt/releases", '_blank').focus();
        });
        this.mqeditorGitHub.addEventListener("click", () => {
            window.open("https://github.com/atEchoOff/mqeditor", "_blank").focus();
        })

        this.darkModeButton.addEventListener("click", toggleDarkMode);

        this.mathButton.addEventListener('mousedown', (event) => {
            event.preventDefault(); // Dont lose focus on editor
            if (document.activeElement.tagName == "TEXTAREA") {
                // We are in a mathquill element, get out
                exitCurrentMathQuillNode();
            } else {
                // Create a new mathquill element and focus!
                placeMathQuillNodeAtSelection();
            }
        });

        this.screenshotMathButton.addEventListener('mousedown', (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element

            try {
                // First, get mathquill element
                const mathquillElement = document.activeElement.parentElement.parentElement;

                if (mathquillElement && mathquillElement.tagName == "SPAN") {
                    // We assume this is a mathquill element
                    downloadMathQuillScreenShot(mathquillElement);
                }
            } catch(_) {}
        });

        this.alignButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element
            
            createEnvironment("align");
        });

        this.tableButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element
            
            createEnvironment("table");
        });

        this.figureButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element
            
            createEnvironment("figure");
        });

        this.createColumnButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element

            executeKeystrokeInSelectedMQ("Shift-Right");
        })

        this.createRowButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element

            executeKeystrokeInSelectedMQ("Shift-Down");
        })

        this.mergeRightButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element

            executeKeystrokeInSelectedMQ("Ctrl-Right");
        })

        this.mergeDownButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element

            executeKeystrokeInSelectedMQ("Ctrl-Down");
        })

        this.noBottomBorderButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // You get it now

            executeKeystrokeInSelectedMQ("\\nbb", cmd=true);
        })

        this.noRightBorderButton.addEventListener("mousedown", (event) => {
            event.preventDefault();

            executeKeystrokeInSelectedMQ("\\nrb", cmd=true);
        })

        this.clearSympyButton.addEventListener('mousedown', () => {
            loadPyScript().then(() => {
                clear_sympy();
            });
        });

        this.loadPyScriptButton.addEventListener('click', loadPyScript);

        this.evalSympyButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not lose focus from mathquill element

            try {
                // First, get mathquill element
                const mathquillElement = document.activeElement.parentElement.parentElement;

                if (mathquillElement && mathquillElement.tagName == "SPAN") {
                    // We assume this is a mathquill element
                    evaluateSympy(MQ(mathquillElement), mathquillElement);
                }
            } catch(_) {}
        })

        // Event listeners for command buttons
        let commandButtons = document.getElementsByClassName("command-button");

        for (let commandButton of commandButtons) {
        const command = commandButton.textContent;
        commandButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // Do not change selection

            // Type command, then apply command and decorate!
            typeText(command);
            nextFrame(() => {
                applyCommand(editor.state, editor.dispatch);
                decorateAndCreateIfNeeded();
            })
        })
}
    }

    decorateFileButton(saved) {
        // If saved, make the button say that. Otherwise, on doc change, call this to change button status

        if (saved) {
            this.fileButton.innerText = "Saved";
        } else {
            this.fileButton.innerText = "File";
        }
    }

    handleButtonChanges() {
        // Activate or deactivate buttons
        if (document.activeElement && document.activeElement.tagName == "TEXTAREA") {
            // We are in a mathquill element
            this.screenshotMathButton.disabled = false;
            if (document.activeElement.parentElement.parentElement.querySelector(".mq-matrix .mq-hasCursor")) {
                // There is a focused matrix/table/gridlike thing! Allow grid movement.
                this.createColumnButton.disabled = false;
                this.createRowButton.disabled = false;
                this.mergeRightButton.disabled = false;
                this.mergeDownButton.disabled = false;
                this.noBottomBorderButton.disabled = false;
                this.noRightBorderButton.disabled = false;
            } else {
                this.createColumnButton.disabled = true;
                this.createRowButton.disabled = true;
                this.mergeRightButton.disabled = true;
                this.mergeDownButton.disabled = true;
                this.noBottomBorderButton.disabled = true;
                this.noRightBorderButton.disabled = true;
            }

            this.mathButton.disabled = false;
            this.mathButton.textContent = "Exit Math";

            this.alignButton.disabled = true;
            this.tableButton.disabled = true;
            this.figureButton.disabled = true;
            this.evalSympyButton.disabled = false;

            this.commandDropDown.disabled = true;
        } else {
            // We are out of mathquill element
            this.screenshotMathButton.disabled = true;
            this.createColumnButton.disabled = true;
            this.createRowButton.disabled = true;
            this.mergeRightButton.disabled = true;
            this.mergeDownButton.disabled = true;
            this.noBottomBorderButton.disabled = true;
            this.noRightBorderButton.disabled = true;

            this.mathButton.disabled = false;
            this.mathButton.textContent = "Create Math";

            this.alignButton.disabled = false;
            this.tableButton.disabled = false;
            this.figureButton.disabled = false;
            this.evalSympyButton.disabled = true;

            this.commandDropDown.disabled = false;
        }

        if (document.activeElement && document.activeElement.className == "cm-content") {
            // We are in a code block. 
            this.screenshotMathButton.disabled = true;
            this.createColumnButton.disabled = true;
            this.createRowButton.disabled = true;
            this.mergeRightButton.disabled = true;
            this.mergeDownButton.disabled = true;
            this.noBottomBorderButton.disabled = true;
            this.noRightBorderButton.disabled = true;

            this.mathButton.disabled = true;
            this.mathButton.textContent = "Create Math";
            
            this.alignButton.disabled = true;
            this.tableButton.disabled = true;
            this.figureButton.disabled = true;
            this.evalSympyButton.disabled = true;

            this.commandDropDown.disabled = true;
        }
    }

    enableSymPyButton() {
        // Enable sympy button on creation
        this.clearSympyButton.disabled = false;
    }
}

const buttonManager = new ButtonManager();