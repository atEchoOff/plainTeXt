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
        } else if (child.type.name === "image") {
            nodes.push(child.copy(child));
        } else if (child.type.name === "text" && child.marks.length) {
            // Serialize mark as latex
            if (child.marks[0].type.name === "strong") {
                const textNode = schema.text("\\textbf{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "em") {
                const textNode = schema.text("\\textit{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "link") {
                const textNode = schema.text("\\eqref{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "code") {
                const textNode = schema.text("\\texttt{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "section") {
                const textNode = schema.text("\\section{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "subsection") {
                const textNode = schema.text("\\subsection{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "citation") {
                const textNode = schema.text("\\cite{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "theorem") {
                const textNode = schema.text("\\theorem{" + child.text + "}");
                nodes.push(textNode);
            } else if (child.marks[0].type.name === "qed") {
                const textNode = schema.text("\\qed{ }");
                nodes.push(textNode);
            }
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
    // Look for $...$ for math or \textbf{...} etc
    const mqregex = /(\$[^\$]*\$)|/
    const textbfregex = /(\\textbf\{((?!\\textbf\{)[^}]*)\})|/
    const textitregex = /(\\textit\{((?!\\textit\{)[^}]*)\})|/
    const eqrefregex = /(\\eqref\{((?!\\eqref\{)[^}]*)\})|/
    const textttregex = /(\\texttt\{((?!\\texttt\{)[^}]*)\})|/
    const sectionregex = /(\\section\{((?!\\section\{)[^}]*)\})|/
    const subsectionregex = /(\\subsection\{((?!\\subsection\{)[^}]*)\})|/
    const citeregex = /(\\cite\{((?!\\cite\{)[^}]*)\})|/
    const imageregex = /(\\includegraphics\{((?!\\includegraphics\{)[^}]*).png\})|/
    const theoremregex = /(\\theorem\{((?!\\theorem\{)[^}]*)\})|/
    const qedregex = /(\\qed\{((?!\\qed\{)[^}]*)\})/
    const regex = new RegExp(
        mqregex.source + 
        textbfregex.source + 
        textitregex.source +
        eqrefregex.source +
        textttregex.source +
        sectionregex.source +
        subsectionregex.source +
        citeregex.source +
        imageregex.source +
        theoremregex.source +
        qedregex.source
    , "g")
    let lastIndex = 0;
    let nodes = [];
    
    // Loop through matches
    pastedText.replace(regex, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, offset) => {
        let text = pastedText.slice(lastIndex, offset);
        if (offset > lastIndex) {
            // This is text
            nodes.push(schema.text(text));
        }

        if (p1) {
            // This is math
            //                                               v Remove the $ from the start and end
            nodes.push(schema.nodes.mathquill.create({latex: p1.slice(1, -1)}));

            lastIndex = offset + match.length;
        } else if (p3) {
            // This is bold text
            nodes.push(schema.text(p3, [schema.marks.strong.create()]));

            lastIndex = offset + match.length;
        } else if (p5) {
            // This is italics text
            nodes.push(schema.text(p5, [schema.marks.em.create()]));

            lastIndex = offset + match.length;
        } else if (p7) {
            // This is a link
            nodes.push(schema.text(p7, [schema.marks.link.create()]));

            lastIndex = offset + match.length;
        } else if (p9) {
            // This is a link
            nodes.push(schema.text(p9, [schema.marks.code.create()]));

            lastIndex = offset + match.length;
        } else if (p11) {
            // This is a section
            nodes.push(schema.text(p11, [schema.marks.section.create()]));

            lastIndex = offset + match.length;
        } else if (p13) {
            // This is a subsection
            nodes.push(schema.text(p13, [schema.marks.subsection.create()]));

            lastIndex = offset + match.length;
        } else if (p15) {
            // This is a citation
            nodes.push(schema.text(p15, [schema.marks.citation.create()]));

            lastIndex = offset + match.length;
        } else if (p17) {
            // This is an image
            if (p17 in imageData) {
                // We are currently setting up, and a previous definition already exists for img
                let imgNode = schema.nodes.image.create({
                    src:imageData[p17]['src'],
                    title:imageData[p17]['title'],
                    aria:''
                }, schema.text(imageData[p17]['title']));

                nodes.push(imgNode);
                // The imageData is done for this, we can remove it
                // If we keep it in, images will reset themselves from global dictionary
                delete imageData[p17];
            }
            lastIndex = offset + match.length;
        } else if (p19) {
            // This is a theorem
            nodes.push(schema.text(p19, [schema.marks.theorem.create()]));

            lastIndex = offset + match.length;
        } else if (p21) {
            // This is a theorem
            nodes.push(schema.text(" ", [schema.marks.qed.create()]));

            lastIndex = offset + match.length;
        }
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
            let imgCounter = 0;
            for (let node of newContent.content) {
                let fragment = node.content;

                if (fragment.size == 0) {
                    // Empty fragments are just empty lines
                    lines.push("");
                } else if (fragment.content && fragment.content.type && fragment.content.type.name === "image") {
                    // The counter is meaningless unless copying the whole doc
                    // For now it is needed to save images between sessions
                    lines.push("\\includegraphics{" + (imgCounter++) + ".png}");
                } else if (fragment.type && fragment.type.name === "image") {
                    lines.push("\\includegraphics{" + (imgCounter++) + ".png}");
                } else {
                    lines.push(fragment.content[0].text);
                }
            }

            return lines.join("\n")
            .replaceAll(/\$\s*\\begin\{align\}/g, "\\begin{align*}")
            .replaceAll(/\\end\{align\}\s*\$/g, "\\end{align*}");
        },

        transformPasted(slice) {
            // Convert latex-formatted slice into pm
            // This is part 2 of pasting
            // See transformPastedText for part 1
            let nodes = [];
            slice.content.forEach((node) => {
                // Nodes in slice.content are split by enter
                // Create a paragraph with each node within this line
                var newNode;
                if (node && node.type && node.type.name == "image") {
                    // This is when a pure image is being pasted
                    newNode = node;
                } else if (node.content.content && node.content.content[0] && node.content.content[0].type.name == "image") {
                    // When a line of pasted text is an image
                    newNode = node.content.content[0];
                } else {
                    let lineText = node.textContent;

                    // zero-width space added to make sure empty lines appear on paste
                    // remove them
                    if (lineText.endsWith("\u8203")) {
                        lineText = lineText.substring(0, lineText.length - 1);
                    }
                    let ttf = textToFrag(lineText);
                    if (ttf && ttf[0] && ttf[0].type && ttf[0].type.name === "image") {
                        // This originally was a text node containing \includegraphics
                        // image data was found in imageData, so ttf is an image node
                        // dont put it in a paragraph
                        newNode = ttf[0];
                    } else {
                        newNode = schema.nodes.paragraph.create(null, Fragment.fromArray(ttf));
                    }
                }
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
            text = text.replaceAll(/\\begin\{align\**\}/g, "$\\begin{align}")
                       .replaceAll(/\\end\{align\**\}/g, "\\end{align}$");

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
                        return; // This is temporary, I dont like leaving mq from the right
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
        } else if (event.ctrlKey && event.shiftKey && event.key === "B") {
            event.preventDefault();
            this.mathField.cmd("\\vecf");
        } else if (event.ctrlKey && event.key === "b") {
            event.preventDefault();
            this.mathField.cmd("\\vect");
        } else if (event.key === "&") {
            event.preventDefault();
            this.mathField.cmd("\\aligned");
        }
        
        else {
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

function refreshHighlights() {
    // Handle visible highlighting of mathquill nodes

    // Unhighlight all highlighted nodes
    const highlighted = [...document.getElementsByClassName("highlighted")];
    for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].classList.remove("highlighted");
    }

    // Check if the selection contains mathquill
    const { from, to } = editor.state.selection;
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === "mathquill") {
            // Highlight me!
            editor.nodeDOM(pos).classList.add("highlighted");
        }
    })
}