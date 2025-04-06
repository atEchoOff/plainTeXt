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
    parseDOM: [{tag: "p"}],
    toDOM: () => ["p", 0]
};
  
// Define the 'text' node
const textSpec = {
    group: "inline"
};

// Load in mathquill setup
// this is a fake command, babel doesnt like to combine files for some reason
import_from_local("mathquill.js");
import_from_local("image.js");

const schema = new Schema({
    nodes: {
        // Include all specs
        doc: docSpec,
        paragraph: paragraphSpec,
        text: textSpec,
        mathquill: mathQuillNodeSpec,
        image: imageSpec
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
        return true; // do not do default action
    }

    return command;
}

function applyCommand(state, dispatch) {
    // Allow shortcuts for keybinds that are hard to remember
    // ex. \bold{ for bold text instead of ctrl+b. 
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
        tr = tr.delete(indexOfSlash, curPos);
        

        // Now apply the mark!
        if (command === "textbf" || command === "bold") {
            tr = tr.setStoredMarks([schema.marks.strong.create()]);
        } else if (command === "textit") {
            tr = tr.setStoredMarks([schema.marks.em.create()]);
        } else if (command === "eqref") {
            tr = tr.setStoredMarks([schema.marks.link.create()]);
        } else if (command === "verb") {
            tr = tr.setStoredMarks([schema.marks.code.create()]);
        } else if (command === "section") {
            tr = tr.setStoredMarks([schema.marks.section.create()]);
        } else if (command === "subsection") {
            tr = tr.setStoredMarks([schema.marks.subsection.create()]);
        } else if (command === "cite") {
            tr = tr.setStoredMarks([schema.marks.citation.create()]);
        } else if (command === "theorem") {
            tr = tr.setStoredMarks([schema.marks.theorem.create()]);
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
    return true;
}

const toggleBold = steamrollMark(schema.marks.strong);
const toggleItalics = steamrollMark(schema.marks.em);
const toggleLink = steamrollMark(schema.marks.link);
const toggleCode = steamrollMark(schema.marks.code);
const toggleSection = steamrollMark(schema.marks.section);
const toggleSubsection = steamrollMark(schema.marks.subsection);
const toggleCitation = steamrollMark(schema.marks.citation);

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
                    "Mod-l":toggleLink,
                    "Mod-r":toggleCode,
                    "Shift-Mod-s":toggleSection,
                    "Mod-s":toggleSubsection,
                    "Mod-t":toggleCitation,
                    "{": applyCommand,
                    "}": exitCommand
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
        }
});

// Highlight mathquill elements if needed
document.addEventListener('selectionchange', () => setTimeout(() => {refreshHighlights()}, 0));
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('reference')) {
        // We will attempt to scroll to the last section/mq label with this inner text
        $('.mq-label:contains("' + event.target.innerText + '"), h2:contains("' + event.target.innerText + '"), h3:contains("' + event.target.innerText + '")').get().forEach((label) => {
            if (label.compareDocumentPosition(event.target) & 0x04) {
                label.scrollIntoView();
            }
        })
    }
})
import_from_local("save-open.js");