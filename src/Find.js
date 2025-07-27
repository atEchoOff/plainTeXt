class Find {
    constructor() {
        // Get DOM elements
        this.searchBar = document.getElementById("search-bar");
        this.searchInput = document.getElementById("search-input");
        this.searchButton = document.getElementById("search-button");

        this.searchResultsCount = document.getElementById("search-results-count");

        this.prevButton = document.getElementById("prev-button");
        this.nextButton = document.getElementById("next-button");

        this.closeSearchButton = document.getElementById("close-search-button");

        // Save search results after performing a search
        this.searchResults = [];

        // Save the current viewing index of the search results. 
        this.currentIndex = -1;

        // Bind event listeners
        // Show find on ctrl+f, clear results
        document.addEventListener("keydown", (event) => {
            if (ctrlKey(event) && event.key.toLowerCase() == "f") {
                // Override default ctrl+f
                event.preventDefault();

                // If is hidden, setup search
                if (this.searchBar.classList.contains("hidden")) {
                    this.searchBar.classList.remove("hidden");
                    this.searchInput.value = "";
                    this.searchResultsCount.innerText = "0/0";
                    this.searchResults = [];
                    this.currentIndex = -1;

                    this.searchInput.focus();
                }
            }
        });

        this.searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault(); // No typee type
                this.startSearch(this.searchInput.value);
            }
        })

        this.searchButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // No focus loss
            this.startSearch(this.searchInput.value);
        });

        this.prevButton.addEventListener("mousedown", () => {
            this.searchInput.focus(); // Forces smooth scroll
            this.selectResult((this.currentIndex - 1 + this.searchResults.length) % this.searchResults.length);
        });

        this.nextButton.addEventListener("mousedown", () => {
            this.searchInput.focus(); // Forces smooth scroll
            this.selectResult((this.currentIndex + 1) % this.searchResults.length);
        });

        this.closeSearchButton.addEventListener("mousedown", (event) => {
            event.preventDefault(); // No focus loss
            this.searchBar.classList.add("hidden");
        });
    }

    updateResultCountText() {
        this.searchResultsCount.innerText = this.currentIndex + 1 + "/" + this.searchResults.length;
    }

    startSearch(target) {
        // Search the document text for target, save positions in this.searchResults
        this.searchResults = [];
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "text" && node.text.includes(target)) {
                // This node has the target text. Save [pDOM, start, end], the dom of the <p> paragraph, the start index and end index of the target

                // Get the pDOM (we escape on div too for codeblocks, but they are not virtual so nothing happens when removing virtual attribute)
                let pDOM = editor.nodeDOM(pos);
                if (pDOM) {
                    while (pDOM.tagName !== "P") {
                        pDOM = pDOM.parentElement;
                    }

                    const indexes = indexesOf(node.text, target);
                    for (let index of indexes) {
                        this.searchResults.push([pDOM, pos + index, pos + index + target.length]);
                    }
                }
            } else if (node.type.name === "mathquill" && node.attrs.latex.includes(target)) {
                let pDOM = editor.nodeDOM(pos);
                if (pDOM) {
                    while (pDOM.tagName !== "P") {
                        pDOM = pDOM.parentElement;
                    }

                    this.searchResults.push([pDOM, editor.nodeDOM(pos), "math"]);
                }
            }
        });

        // Scroll to the first occurence, if it exists
        if (this.searchResults.length > 0) {
            this.selectResult(0);
        } else {
            this.currentIndex = -1;
            this.updateResultCountText();
        }
    }

    selectResult(index) {
        // Scroll to and highlight a specified index in the search results
        if (isNaN(index) || index < 0 || index >= this.searchResults.length) {
            console.error("Cannot select a search result that does not exist");
            return;
        }

        let [pDOM, start, end] = this.searchResults[index];

        pDOM.classList.remove("virtual");
        pDOM.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });

        if (end === "math") {
            // This is a math element! Rather than selecting, focus once the scroll is done.
            const focusOnStart = () => {
                MQ(start).focus();
                editorElement.removeEventListener("scrollend", focusOnStart);
            };

            editorElement.addEventListener("scrollend", focusOnStart);
        } else {

            // Highlight the text
            let tr = editor.state.tr;
            let selection = TextSelection.create(tr.doc, start, end);
            editor.dispatch(tr.setSelection(selection).scrollIntoView());
            editor.focus();
        }

        // Update the resultCount text
        this.currentIndex = index;
        this.updateResultCountText();
    }
}

function indexesOf(container, target) {
    // Return a list of indices for which target lies in container
    if (target.length == 0) {
        return [0];
    }

    let indices = [];
    let startIdx = 0;
    while (container.includes(target)) {
        const index = container.indexOf(target);
        indices.push(startIdx + index);

        container = container.substring(index + target.length);
        startIdx += index + target.length;
    }

    return indices;
}

const find = new Find();