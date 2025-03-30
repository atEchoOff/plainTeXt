import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { schema as basicSchema } from "prosemirror-schema-basic";

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

const schema = new Schema({
    nodes: {
        // Include all specs
        doc: docSpec,
        paragraph: paragraphSpec,
        text: textSpec,
        mathquill: mathQuillNodeSpec,
    }, 
    marks: basicSchema.spec.marks,
});

// Allow Ctrl+B for bold
const toggleBold = toggleMark(schema.marks.strong);

editor = new EditorView(editorElement, {
    state: EditorState.create({
        doc: DOMParser.fromSchema(schema).parse(editorElement),
            plugins: [
                history(),
                keymap({"Mod-z":undo, "Mod-y":redo, "Mod-b":toggleBold}),
                keymap(baseKeymap),
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

import_from_local("save-open.js");