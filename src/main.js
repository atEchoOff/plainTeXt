import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";
import {
    defaultSettings,
    imagePlugin,
    
} from "prosemirror-image-plugin";

// Helper to run function at next frame.
// Thanks https://stackoverflow.com/questions/38631302/requestanimationframe-not-waiting-for-the-next-frame
var nextFrame = function(fn) { requestAnimationFrame(function() { requestAnimationFrame(fn); }); };

// Save if we are on Mac
const isMac = /mac/i.test(navigator.userAgentData?.platform || navigator.platform);

// Make a ctrlKey function that works for mac and windows/linux (normal OSes)
var ctrlKey;
if (isMac) {
    ctrlKey = function(event) {
        return event.metaKey;
    }
} else {
    ctrlKey = function(event) {
        return event.ctrlKey;
    }
}

// Setup images
let imagePluginSettings = {...defaultSettings};

// Prosemirror editor object
let editor = null;

// DOM editor element
let editorElement = document.getElementById("editor");

// Define the 'doc' node
const docSpec = {
    content: "block+"
};
  
// Define the 'paragraph' node
const paragraphSpec = {
    content: "inline*",
    group: "block",
    attrs: {
        class: { default: null }
    },
    parseDOM: [{tag: "p"}],
    toDOM: (node) => ["p", node.attrs, 0]
};
  
// Define the 'text' node
const textSpec = {
    group: "inline"
};

// Load in mathquill setup
// this is a fake command, babel doesnt like to combine files for some reason
import_from_local("mathquill.js");
import_from_local("image.js");
import_from_local("codeblock.js");

const schema = new Schema({
    nodes: {
        // Include all specs
        doc: docSpec,
        paragraph: paragraphSpec,
        text: textSpec,
        mathquill: mathQuillNodeSpec,
        image: imageSpec,
        codeBlock: codeBlockSpec
        },
    marks: {
        strong: basicSchema.spec.marks.get("strong"),
        em: basicSchema.spec.marks.get("em"),
        code: basicSchema.spec.marks.get("code"),
        section: {
            parseDOM: [{tag: "h2"}],
            toDOM() { return ["h2", 0] }
        },
        subsection: {
            parseDOM: [{tag: "h3"}],
            toDOM() { return ["h3", 0] }
        },
        link: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'reference'}] }
        },
        citation: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'citation'}] }
        },
        theorem: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'theorem'}] }
        },
        qed: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'qed'}] }
        },
        label: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'reference label'}] } // class label just exists for reference bounce
        },
        definition: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'definition theorem'}] } // theorem label exists for references
        },
        proposition: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'proposition theorem'}] } // theorem label exists for references
        },
        corollary: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'corollary theorem'}] } // theorem label exists for references
        },
        lemma: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'lemma theorem'}] } // theorem label exists for references
        },
        remark: {
            parseDOM: [{tag: "a"}],
            toDOM() { return ["a", {class: 'remark theorem'}] } // theorem label exists for references
        }
    }
});

// Toggle mark, disable all other marks
function steamrollMark(mark) {
    // The command to return
    function command(state, dispatch) {
        // Create a dispatch that adds commands to delete all other marks at selection first
        const {from, to} = state.selection;
        function newDispatch(transaction) {
            for (let markName in schema.marks) {
                if (markName !== mark.name) {
                    transaction = transaction.removeMark(from, to, schema.marks[markName]);
                    transaction = transaction.removeStoredMark(schema.marks[markName]);
                }
            }

            return dispatch(transaction);
        }

        // Toggle the mark :)
        toggleMark(mark)(state, newDispatch)

        if (state.selection.$head.marks().length == 0 || (state.selection.$head.marks().length > 0 && state.selection.$head.marks()[0].type.name != mark.name)) {
            // We were not in a mark, so it needs to be decorated. Or, we need to redecorate because an old mark is replaced
            createNewMark = true;
            nextFrame(() => {decorateMark(getDeepestElementAtSelection());});
        } else {
            // We were in a mark, so all marks should be undecorated. 
            const div = document.createElement("div");
            decorateMark(div);
        }
        return true; // do not do default action
    }

    return command;
}

function applyCommand(state, dispatch) {
    // Allow shortcuts for keybinds that are hard to remember
    // ex. \bold{ for bold text instead of ctrl+b. 
    // Only apply command if not inside a mark
    if (state.selection.$head.marks().length == 0) {
        let curPos = state.selection.$head.pos;
        let currentTextNode = state.doc.nodeAt(curPos - 1);
        if (!currentTextNode || !currentTextNode.type || (currentTextNode.type.name == "mathquill")) {
            // Leave mathquill elements alone
            return false;
        }

        // Find the last slash before the current position
        let indexOfSlash = curPos;
        while (indexOfSlash >= 0 && state.doc.textBetween(indexOfSlash, indexOfSlash + 1) !== "\\") {
            indexOfSlash--;
        }
        if (indexOfSlash < 0) {
            // Improper formatting
            return false;
        }

        // Get the command, and then delete it from the doc
        let command = state.doc.textBetween(indexOfSlash + 1, curPos);
        let tr = state.tr;        

        // Now apply the mark!
        if (command === "textbf" || command === "bold") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.strong.create()]);
        } else if (command === "textit") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.em.create()]);
        } else if (command === "eqref") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.link.create()]);
        } else if (command === "verb" || command === "texttt") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.code.create()]);
        } else if (command === "section") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.section.create()]);
        } else if (command === "subsection") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.subsection.create()]);
        } else if (command === "cite") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.citation.create()]);
        } else if (command === "theorem") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.theorem.create()]);
        } else if (command === "qed") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.qed.create()]);
        } else if (command === "label") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.label.create()]);
        } else if (command === "definition" || command === "def") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.definition.create()]);
        } else if (command === "proposition" || command === "prop") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.proposition.create()]);
        } else if (command === "corollary" || command === "cor") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.corollary.create()]);
        } else if (command === "lemma") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.lemma.create()]);
        } else if (command === "remark") {
            tr = tr.delete(indexOfSlash, curPos);
            tr = tr.setStoredMarks([schema.marks.remark.create()]);
        } else if (command === "python" || command === "javascript" || command === "java") {
            tr = tr.delete(indexOfSlash, curPos);
            
            // Set initialize to true to focus on creation
            const codeBlockNode = schema.nodes.codeBlock.create({initialize: true, lang: command});

            tr = tr.replaceSelectionWith(codeBlockNode);
        } else if (command === "align") {
            // We will completely return here so we dont dispatch the transaction
            // ALlows us to use createAlignEnvironment
            tr = tr.delete(indexOfSlash, curPos);

            nextFrame(createAlignEnvironment);
        }

        if (command !== "python" && command !== "javascript" && command !== "java") {
            createNewMark = true; // We trigger zero width space creation to make visible
        }

        dispatch(tr);
    } else {
        return false;
    }
    return true;
}

function exitCommand(state, dispatch) {
    // Exit out of the current mark by undoing the mark

    let curPos = state.selection.from;
    let currentTextNode = state.doc.nodeAt(curPos - 1);
    if (!currentTextNode || !currentTextNode.type || (currentTextNode.type.name == "mathquill")) {
        // Leave mathquill elements alone
        return false;
    }

    // Remove all marks!
    let tr = state.tr;
    tr = tr.setStoredMarks([]);
    dispatch(tr);

    // Also, we will undecorate the current mark
    // To do this, create a placeholder element
    const div = document.createElement("div");
    decorateMark(div);
    return true;
}

const toggleBold = steamrollMark(schema.marks.strong);
const toggleItalics = steamrollMark(schema.marks.em);

function noSingleZeroWidthSpaces(state, dispatch) {
    // If we are backspacing into a zero width space for a mark, delete the mark
    const currentElement = getDeepestElementAtSelection();
    if (currentElement && currentElement.innerText == "\u200b") {
        
        let tr = state.tr;
        let curpos = state.selection.$head.pos;

        tr = tr.delete(curpos - 1, curpos);
        tr = tr.setStoredMarks([]);
        dispatch(tr);
        return true;
    }
}

editor = new EditorView(editorElement, {
    state: EditorState.create({
        doc: DOMParser.fromSchema(schema).parse(editorElement),
            plugins: [
                history(),
                keymap({
                    "Mod-z":undo, 
                    "Mod-y":redo, 
                    "Mod-b":toggleBold, 
                    "Mod-i":toggleItalics,
                    "{": applyCommand,
                    "}": exitCommand,
                    "Backspace": noSingleZeroWidthSpaces
                }),
                keymap(baseKeymap),
                imagePlugin({...imagePluginSettings}),
                mathQuillInputRule, // Create mathquill element on ;
                mathQuillPlugin
            ],
        }),
        nodeViews: {
            mathquill(node, view, getPos) {
                return new MathQuillNodeView(node, view, getPos);
            },

            codeBlock(node, view, getPos) {
                return new CodeBlockView(node, view, getPos);
            }
        }
});

function simulateKeyPress(key) {
    let event = document.createEvent("Event");
    event.initEvent("keydown", true, true);
    event.key = event.code = key;
    return editor.someProp("handleKeyDown", f => f(editor, event));
}

function typeText(text) {
    // Get selection
    const pos = editor.state.selection.$anchor.pos;

    // Commit to prosemirror
    const transaction = editor.state.tr.insertText(text, pos);
    editor.dispatch(transaction);
}

function cursorOffset(offset) {
    // Move left or right by offset
    const pos = editor.state.selection.$anchor.pos + offset;
    let tr = editor.state.tr;
    let selection = TextSelection.create(tr.doc, pos);
    editor.dispatch(tr.setSelection(selection).scrollIntoView());
    editor.focus();
}

function getDeepestElementAtSelection() {
    const sel = window.getSelection();
  
    // Return null if theres no selection
    if (!sel) return null;

    const node = sel.anchorNode;
    
    if (!node) return null;

    if (node.tagName == "P" && node.hasChildNodes && node.childNodes.length == 1) {
        // If the element is alone on this line, we get the paragraph instead. Return its child
        return node.firstChild;
    }

    if (!window.chrome && node.tagName == "P" && node.hasChildNodes) {
        // Fix a firefix glitch where <p> is erroneously selected as the anchor node even when selecting an existing marked tag
        return node.lastChild;
    }

    // We dont want text nodes
    if (node.nodeType === Node.TEXT_NODE) {
        return node.parentElement;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        return node;
    }

    return null;
}

// Save whether or not we want to create a new (empty) mark tag
let createNewMark = false;

function decorateMark(element) {
    if (element) {
        // First, unselect selected elements (copy so that .remove() doesnt mess up loop)
        const selectedElements = [...document.getElementsByClassName("selected-mark")];
        for (let selectedElement of selectedElements) {
            // If the mark has *just* a zero width space, it is invisible and unusable. Delete it!
            if (element !== selectedElement && selectedElement.innerText == "\u200b") {
                selectedElement.remove();
            } else if (element !== selectedElement) {
                selectedElement.classList.remove("selected-mark");
            }
        }

        // Select selected element (only if editor.state.storedMarks is null i.e. we are in a mark)
        if (markTags.has(element.tagName) && !!!editor.state.storedMarks) {
            nextFrame(() => {element.classList.add("selected-mark");})
        }
    }
}

const commandDropDown = document.getElementById("command-drop-down");

function handleButtonChanges() {
    // Activate or deactivate buttons
    if (document.activeElement && document.activeElement.tagName == "TEXTAREA") {
        // We are in a mathquill element
        screenshotMathButton.disabled = false;

        mathButton.disabled = false;
        mathButton.textContent = "Exit Math";

        alignButton.disabled = true;
        evalSympyButton.disabled = false;

        commandDropDown.disabled = true;
    } else {
        // We are out of mathquill element
        screenshotMathButton.disabled = true;

        mathButton.disabled = false;
        mathButton.textContent = "Create Math";

        alignButton.disabled = false;
        evalSympyButton.disabled = true;

        commandDropDown.disabled = false;
    }

    if (document.activeElement && document.activeElement.className == "cm-content") {
        // We are in a code block. 
        screenshotMathButton.disabled = true;

        mathButton.disabled = true;
        mathButton.textContent = "Create Math";
        
        alignButton.disabled = true;
        evalSympyButton.disabled = true;

        commandDropDown.disabled = true;
    }
}

// Valid tagNames for mark tags (FIXME this needs changing if a mark tag changes...)
const markTags = new Set(["H2", "H3", "CODE", "EM", "STRONG", "A"]);

document.addEventListener('selectionchange', () => {
    // Highlight mathquill elements if needed
    nextFrame(refreshHighlights); 
    
    // Handle any button changes based on mathquill focus
    nextFrame(handleButtonChanges);
});

document.addEventListener('click', (event) => {
    if (ctrlKey(event) && event.target.classList.contains('reference') || event.target.classList.contains('mq-reference')) {
        // Handle moving to label for reference
        let foundTarget = false;
        let searchText = event.target.innerText.replaceAll("\u200b", ""); // silly mathquill, no zero-width spaces please!

        // Only search for stuff after semicolon
        searchText = searchText.substring(searchText.indexOf(":") + 1);
        
        // We will attempt to scroll to a section/mq label with this inner text
        $('.mq-label:contains("' + searchText + '"), h2:contains("' + searchText + '"), h3:contains("' + searchText + '")').get().forEach((label) => {
            // if (label.compareDocumentPosition(event.target) & 0x04) {
            label.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
            foundTarget = true;
            // }
        });

        if (!foundTarget) {
            // Maybe belongs to a figure?
            $('.label:contains("' + searchText + '")').get().forEach((label) => {
                // if (label.compareDocumentPosition(event.target) & 0x02) {
                label.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
                foundTarget = true;
                // }
            });
        }

        if (!foundTarget) {
            // Maybe belongs to a theorem?
            $('.theorem:contains("' + searchText + '")').get().forEach((label) => {
                // if (label.compareDocumentPosition(event.target) & 0x04) {
                label.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
                // }
            });
        }
    } else {
        // This is just a click, handle mark decorations
        nextFrame(() => {decorateMark(getDeepestElementAtSelection());});
    }
})

function decorateAndCreateIfNeeded() {
    // Decorate the current element, place in zero width space to make it visible
    const element = getDeepestElementAtSelection();
    decorateMark(element);

    if (createNewMark && editor.state.storedMarks && editor.state.storedMarks.length == 1) {
        // This happens when a mark is triggered by prosemirror. However, it doesnt create a tag
        // Since we want decorations, this force creates the tag
        typeText("\u200b");
        nextFrame(() => {decorateMark(getDeepestElementAtSelection());});
        createNewMark = false;
    }
}

document.addEventListener('keydown', (event) => {
    // Refresh mark decorations when typing
    nextFrame(decorateAndCreateIfNeeded);

    // Handle keybinds
    if (ctrlKey(event) && event.key.toLowerCase() == "s") {
        event.preventDefault();
        saveFile();
    } else if (ctrlKey(event) && event.shiftKey && event.key == "O") {
        event.preventDefault();
        toOverleaf();
        alert("To view figures in Overleaf, download figures first and transfer to Overleaf.");
    } else if (ctrlKey(event) && event.key.toLowerCase() == "o") {
        event.preventDefault();
        openFile();
    } else if (ctrlKey(event) && event.shiftKey && event.key == "L") {
        event.preventDefault();
        latext(); // Will copy result to clipboard
        alert("LaTeX copied to clipboard!");
    }

    scrollCursorIntoView();
})

import_from_local("virtualscroll.js");
import_from_local("save-open.js");

function isElectron() {
    // https://stackoverflow.com/questions/61725325/detect-an-electron-instance-via-javascript
    // Renderer process
    if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
        return true;
    }

    // Main process
    if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
        return true;
    }

    // Detect the user agent when the `nodeIntegration` option is set to true
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true;
    }

    return false;
}

// Save if pyscript is loaded
let pyScriptLoaded = false;

function loadPyScript() {
    // Load PyScript if not already loaded
    return new Promise((resolve, reject) => {
        if (pyScriptLoaded) {
            // We already have it loaded
            resolve();
            return;
        }

        // Add an element to tell user pyscript is loading
        console.log("Loading PyScript...")
        const loaderElement = document.createElement("div");
        loaderElement.innerText = "PyScript is loading, please wait...";
        loaderElement.classList.add("py-script-loader");

        document.body.appendChild(loaderElement);

        pyScriptLoaded = true; // Save loaded status so we dont load again

        // Add PyScript CSS
        const link = document.createElement("link");
        link.rel = "stylesheet";

        if (isElectron()) {
            // In electron, so load locally!
            link.href = "dist/pyscript/core.css";
        } else {
            loaderElement.innerText += "\nDownloading PyScript...";
            link.href = "https://pyscript.net/releases/2025.5.1/core.css";
        }

        document.head.appendChild(link);

        // Add PyScript JS
        const script = document.createElement("script");
        script.type = "module";

        if (isElectron()) {
            // In electron, so load locally!
            script.src = "dist/pyscript/core.js";
        } else {
            script.src = "https://pyscript.net/releases/2025.5.1/core.js";
        }

        document.head.appendChild(script);

        script.onload = () => {
            // Load cas.py code
            const pyScript = document.createElement("py-script");
            pyScript.textContent = `
import_from_local("cas.py");
`;
            document.body.appendChild(pyScript);

            // Wait for sympy function to exist and then load
            const interval = setInterval(() => {
                try {
                    if (!!window["sympify"]) {
                        console.log("PyScript loaded")
                        clearInterval(interval);

                        clearSympyButton.disabled = false; // Enable sympy button
                        
                        // Remove the loader element
                        loaderElement.remove();
                        resolve();
                    }
                } catch (e) {
                    // Still initializing
                }
            }, 100);
        };

        script.onerror = () => reject(new Error("Failed to load PyScript"));
    });
}

const loadPyScriptButton = document.getElementById("load-pyscript");

loadPyScriptButton.addEventListener('click', loadPyScript);

// Make command buttons functional
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

const latextGitHub = document.getElementById("latext-github");
const latextDownload = document.getElementById("latext-download");
const mqeditorGitHub = document.getElementById("mqeditor-github");

latextGitHub.addEventListener("click", () => {
    window.open("https://github.com/atEchoOff/MathScript", '_blank').focus();
});

latextDownload.addEventListener("click", () => {
    window.open("https://github.com/atEchoOff/MathScript/releases", '_blank').focus();
});

mqeditorGitHub.addEventListener("click", () => {
    window.open("https://github.com/atEchoOff/mqeditor", "_blank").focus();
})

const darkModeButton = document.getElementById("dark-mode-button");

darkModeButton.addEventListener("click", () => {
    if (document.body.classList.contains("dark")) {
        document.body.classList.remove("dark");
    } else {
        document.body.classList.add("dark");
    }
})