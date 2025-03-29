import { InputRule, inputRules } from "prosemirror-inputrules";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Fragment, Slice } from "prosemirror-model";

// Global mathquill handler
let MQ = MathQuill.getInterface(2);

function focusMathQuillNode(view, pos, isLeft) {
    // Focus in a mathquill node on a specified side

    // Retrieve the mathquill node
    // FIXME this is terrible. We have the node when we are calling this
    // but I cannot find a way to turn that node into the actual element for mathquill
    const mathQuillNodeView = view.nodeDOM(pos);

    // Get the mathquill api
    const mathField = MQ(mathQuillNodeView);
    if (mathField) {
        mathField.focus();
        if (isLeft) {
            mathField.moveToLeftEnd();
        } else {
            mathField.moveToRightEnd();
        }
    }
}

function fragToTextFrag(fragment) {
    // Convert fragment to latex form for copy
    let nodes = [];
    fragment.forEach((child) => {
        if (child.type.name === "mathquill") {
            // Convert mathquill node to $latex$ textnode
            const textNode = schema.text("$" + child.attrs.latex + "$");
            nodes.push(textNode);
        } else if (child.content) {
            // For non-leaf nodes, recursively transform their content
            nodes.push(child.copy(fragToTextFrag(child.content)));
        } else {
            // Leaf nodes that are not MathQuill nodes are unchanged
            nodes.push(child);
        }
    });
    return Fragment.fromArray(nodes);
}

function textToFrag(pastedText) {
    // "Inverse" of fragToTextFrag
    // Convert string text to fragment to paste
    const regex = /(\$[^\$]*\$)/g; // Look for $...$ in the text
    let lastIndex = 0;
    let nodes = [];
    
    // Loop through all $...$ instances in the text
    pastedText.replace(regex, (match, p1, offset) => {
        let text = pastedText.slice(lastIndex, offset);
        if (offset > lastIndex) {
            // This is text
            nodes.push(schema.text(text));
        }
        // This is math
        //                                               v Remove the $ from the start and end
        nodes.push(schema.nodes.mathquill.create({latex: p1.slice(1, -1)}));

        lastIndex = offset + p1.length;
    });
    
    // Add any remaining text
    if (lastIndex < pastedText.length) {
        nodes.push(schema.text(pastedText.slice(lastIndex)));
    }

    return nodes;
}

function verticalAlign(mathquillElement) {
    // If possible, align mathquill element by its first aligned character
    // This will make sure mathquill elements align vertically with horizontal text
    let rootBlock = mathquillElement.lastChild.firstChild;

    // Move through parenthesis/brackets until we get to aligned math
    while (rootBlock && rootBlock.classList && rootBlock.classList.contains("mq-bracket-container")) {
        rootBlock = rootBlock.children[1].firstChild;
    }

    if (rootBlock === null || rootBlock.classList === null) {
        return;
    }

    // Line up the mathquill container so that the aligned text is centered vertically
    let root = rootBlock.getBoundingClientRect();
    let container = mathquillElement.getBoundingClientRect();
    mathquillElement.style.verticalAlign = (root.top - container.top)/2 + (root.bottom - container.bottom)/2 + 2 + "px"
}

const mathQuillPlugin = new Plugin({
    key: new PluginKey("mathQuill"),
    props: {
        handleKeyDown(view, event) {
            // Handles entering into MQ element with l/r arrow keys
            const {selection, doc} = view.state;
            const {from, to} = selection;
  
            // Right arrow key, check if we're to the left of a MathQuill node
            if (event.key === "ArrowRight" && from === to) {
                const nodeAfter = doc.nodeAt(from);
                if (nodeAfter && nodeAfter.type.name === "mathquill") {
                    // This is a mathquill node, lets enter it
                    event.preventDefault();
                    focusMathQuillNode(view, from, true);
                    return true;
                }
            }
  
            // Left arrow key, check if we're to the right of a MathQuill node
            else if (event.key === "ArrowLeft" && from === to) {
                const nodeBefore = doc.nodeAt(from - 1);
                if (nodeBefore && nodeBefore.type.name === "mathquill") {
                    // This is a mathquill node, lets enter it
                    event.preventDefault();
                    focusMathQuillNode(view, from - 1, false);
                    return true;
                }
            }
            return false; // no changes were made
        },

        transformCopied(slice) {
            // Copy elements right from editor
            const newContent = fragToTextFrag(slice.content);

            return new Slice(newContent, slice.openStart, slice.openEnd);
        },

        clipboardTextSerializer(slice) {
            // Handle how the text on the clipboard looks after copying
            // This is necessary because transformCopied will double empty spaces
            const newContent = fragToTextFrag(slice.content);

            let lines = [];
            for (let node of newContent.content) {
                let fragment = node.content;

                // Empty fragments are just empty lines
                if (fragment.size == 0) {
                    lines.push("");
                } else {
                    lines.push(fragment.content[0].text)
                }
            }

            return lines.join("\n");
        },

        transformPasted(slice) {
            // Convert latex-formatted slice into pm
            // This is part 2 of pasting
            // See transformPastedText for part 1
            let nodes = [];
            slice.content.forEach((node) => {
                // Nodes in slice.content are split by enter
                // Create a paragraph with each node within this line
                let lineText = node.textContent;

                // zero-width space added to make sure empty lines appear on paste
                // remove them
                if (lineText.endsWith("\u8203")) {
                    lineText = lineText.substring(0, lineText.length - 1);
                }
                let newNode = schema.nodes.paragraph.create(null, Fragment.fromArray(textToFrag(lineText)));
                nodes.push(newNode);
            });

            let frag = Fragment.fromArray(nodes);

            return new Slice(frag, slice.openStart, slice.openEnd);
        }, 

        handlePaste(view, event, slice) {
            // Dont be doing any pasting when the user is trying to paste inside mathquill
            // cringe
            if (event.target.tagName === "TEXTAREA") {
                // This is a mathquill element
                return true; // true == dont paste
            }

            return false; // false == do paste ... what?
        },

        transformPastedText(text) {
            // Part 1 of pasting
            // See transformPasted for part 2
            // First add zero-width spaces to make sure empty lines count
            let lines = text.split("\n");
            
            for (var i = 0; i < lines.length; i++) {
                lines[i] += "\u8203";
            }

            return lines.join("\n");
        }
    }
});

class MathQuillNodeView {
    constructor(node, view, getPos) {
        this.dom = document.createElement("span");
        this.getPos = getPos;
        this.mathField = MQ.MathField(this.dom, {
            handlers: {
                moveOutOf: function(dir, mathField) {
                    // Handle moving out of the mathquill node with l/r arrow keys

                    // Figure out where we are
                    let pos = getPos();
                    let {tr} = view.state;

                    if (dir == MQ.R) {
                        pos++;
                    }
                    
                    // Create selection for new cursor position
                    let selection = TextSelection.create(tr.doc, pos);
                    view.dispatch(tr.setSelection(selection).scrollIntoView());
                    view.focus(); // Focus on cursor outside of mathquill node
                },
            }
        });

        // Show latex in DOM (on node recreation, need to repopulate latex)
        this.mathField.latex(node.attrs.latex);
        if (node.attrs.initialize) {
            // Focus on creation
            setTimeout(() => {this.mathField.focus();}, 0);
        }

        // Realign element after pasting latex
        setTimeout(() => {verticalAlign(this.dom);}, 0);

        // Event handlers
        this.dom.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.dom.querySelector('textarea').addEventListener('blur', (e) => this.handleBlur());
        this.dom.addEventListener('paste', (e) => this.handlePaste(e));
    }

    handleKeyDown(event) {
        if (event.key === ";") {
            // Leave focus and move cursor after mq node on ";"
            event.preventDefault();

            // Select after the node
            let pos = this.getPos() + 1;
            let {tr} = editor.state;
            let selection = TextSelection.create(tr.doc, pos);
            editor.dispatch(tr.setSelection(selection).scrollIntoView());
            editor.focus();
            return true;
        } else if (event.key === "Enter") {
            // Enter should do nothing inside mathquill elements
            event.preventDefault();
        } else {
            // Vertical align when new key entered
            setTimeout(() => {verticalAlign(this.dom);}, 0);
        }
    }

    handleBlur() {
        // Save latex in latex field when leaving mathquill
        // When mathquill object resets, it needs latex to render again
        const latex = this.mathField.latex();

        // Search for my node and set the new latex
        // Mathquill node may no longer exist (ex. ctrl+z on element)
        // In that case, we want to focus where we were before
        const pos = this.getPos();
        if (pos !== undefined) {
            const tr = editor.state.tr.setNodeMarkup(pos, null, {latex: latex});
            editor.dispatch(tr);
        } else {
            // node no longer exists, focus where it used to be
            editor.focus();
        }
    }

    handlePaste(e) {
        // Manually write pasted text
        // This is a necessary workaround for prosemirror cancelling paste event
        this.mathField.write(e.clipboardData.getData("text"));
    }
}

const mathQuillNodeSpec = {
    atom: true,
    inline: true,
    group: "inline",
    selectable: true,
    toDOM: () => ["span", {}],
    parseDOM: [{
        tag: "span",
    }],
    attrs: {
        latex: {default: ''}, // latex of the math element. Empty on creation
        initialize: {default: false}, // only true on first creation, used for initial focus
    }
};

function insertMathQuillRule() {
    // Create a mathquill node on ;
    return new InputRule(/;$/, (state, match, start, end) => {
        // Define the new node
        // initialize = true to focus on creation
        const mathquillNode = schema.nodes.mathquill.create({initialize: true});

        // Commit to prosemirror
        const transaction = state.tr.replaceRangeWith(start, end, mathquillNode);
        return transaction;
    });
}

// Convert to plugin for prosemirror
const mathQuillInputRule = inputRules({
    rules: [insertMathQuillRule()],
});

function allDomNodesBetween(start, end) {
    // Return a list of all dom nodes between some start node and some end node
    // Include only elements that are children of the <p> rows of editor
    // used for visible highlighting
    let nodes = [];
    let current = start;

    if (start === end) {
        return [];
    }

    if (current.tagName === "P") {
        current = current.firstChild;
    }

    // iterate until we reach the end
    while (current !== end) {
        nodes.push(current);
        
        if (!current.nextSibling) {
            // We are likely at the end of a <p>
            current = current.parentNode;

            if (end === current) {
                // We are done :(
                break;
            }
            
            // Continue onto the next <p>
            current = current.nextSibling.firstChild;
        } else {
            current = current.nextSibling;
        }
    }

    return nodes;
}

function refreshHighlights() {
    // Handle visible highlighting of mathquill nodes

    // Unhighlight all highlighted nodes
    const highlighted = [...document.getElementsByClassName("highlighted")];
    for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].classList.remove("highlighted");
    }

    // Check if the selection contains mathquill
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Highlight all nodes between the start and end of the selection
        const nodes = allDomNodesBetween(range.startContainer, range.endContainer);
        for (let node of nodes) {
            if (node.classList && node.classList.contains("mq-math-mode")) {
                // This is a mathquill node
                node.classList.add("highlighted");
            }
        }
    }
}