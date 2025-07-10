// Completely ignore any changes to class of <p>. Lets us modify class of <p> for virtual scrolling
class ParagraphNodeView {
    constructor() {
        this.dom = document.createElement('p');
        
        // Let prosemirror handle updates (Setting the contentDOM property does this)
        this.contentDOM = this.dom;
    }

    ignoreMutation(mutation) {
        // Only ignore if attribute change
        if (mutation.type !== 'attributes') {
            return false;
        }
        
        // specifically "class"
        if (mutation.attributeName !== 'class') {
            return false;
        }

        // Otherwise we good :)
        return true;
    }
}

const virtualScrollPluginKey = new PluginKey("virtual-scroll");

export const virtualScrollPlugin = new Plugin({
    key: virtualScrollPluginKey,

    view(editorView) {
        const intersectionObserver = new IntersectionObserver((entries) => {
            const {to, from} = editorView.state.selection;

            entries.forEach(entry => {
                // Start and end of current <p> tag
                const p_from = editorView.posAtDOM(entry.target, 0) - 1;
                const node = editorView.state.doc.nodeAt(p_from);
                const p_to = p_from + node.nodeSize;

                // Check if any part of text selection lies inside <p> tag
                if (((p_from <= from) && (from <= p_to)) || ((p_from <= to) && (to <= p_to)) || ((from <= p_from && p_from <= to))) {
                    console.log("Ignoring <p> with text selection")
                    return;
                }

                // Check if <p> tag has focused math
                if (entry.target.querySelector(".mq-focused")) {
                    console.log("Ignoring <p> with mathquill selection")
                    return;
                }

                // "unselected" <p> tag can be hidden or made visible
                const isVirtual = entry.target.classList.contains("virtual");
                if (entry.isIntersecting && isVirtual) {
                    entry.target.classList.remove("virtual");
                } else if (!entry.isIntersecting && !isVirtual) {
                    entry.target.classList.add("virtual");
                }
            });
        }, {
            root: editorView.dom.parentElement,
            rootMargin: "200px 0px",
        });

        // Add <p> tags to intersectionObserver (or remove if destroyed)
        // Note that this specifically exclused images and code blocks. 
        // We will assume there aren't many of them, but they will stay visible.
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === "P") intersectionObserver.observe(node);
                });
                mutation.removedNodes.forEach(node => {
                    if (node.nodeName === "P") intersectionObserver.unobserve(node);
                });
            });
        });

        // Initial setup
        editorView.dom.querySelectorAll('p').forEach(p => intersectionObserver.observe(p));
        mutationObserver.observe(editorView.dom, { childList: true });

        return {
            destroy() {
                intersectionObserver.disconnect();
                mutationObserver.disconnect();
            }
        };
    },
});