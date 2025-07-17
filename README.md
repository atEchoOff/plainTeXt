# [plainTeXt](https://github.com/atEchoOff/plainTeXt)



by [Brian Christner](https://github.com/atEchoOff)

*plainTeXt* is a WYSIWYG LaTeX editor for taking readable notes, sketching, or drafting quickly. It is built with [ProseMirror](https://github.com/prosemirror) and my custom fork of [MathQuill](https://github.com/mathquill), [MathQuill](https://github.com/atEchoOff/MathQuill), which adds features such as matrices, figures, and tables, adds convenient shorthand, and fixes some small bugs. It has built-in and locally-run [SymPy](https://github.com/sympy/sympy) for evaluating complicated expressions, a math screenshot tool, and direct export to Overleaf available. 

I have personally used a prototype of *plainTeXt* for 6 years, through my undergrad at the University of Virginia and in grad school at Rice University. Over this time, I have recieved many requests to publish my repo, but since everything was contained in one hellishly large HTML file, with substantial and unapologetic use of javascripts famous [execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand), I did not. With the help of prosemirror, the resulting *plainTeXt* product is much more attractive.

With *plainTeXt*, I was able to take notes much faster than I otherwise would have with pencil and paper. And an added bonus, it can compile directly to LaTeX, providing a much cleaner set of notes for review afterthefact.

Note that everything (and I mean *everything*) is done completely locally, other than downloading some libraries online. The documents you edit never touch the internet, and the SymPy commands you execute are run *completely* in your browser, without querying any API. This is purposeful. I care deeply about privacy when writing my class notes, doing exams, and writing papers, since I do not want any confidential information freely traveling through the internet. The documents you write with *plainTeXt* are yours and completely yours. The SymPy commands you execute are yours and completely yours.

Please, if you see fit, feel free to use, download, modify, and share this repo! *plainTeXt* has been an absolute lifesaver for me throughout my math major and masters. If modifications are made, please publish per the MPL 2.0 [LICENSE](https://github.com/atEchoOff/plainTeXt/blob/main/LICENSE). 

## Features of *plainTeXt*:
- WYSIWYG (what you see is what you get):
    - Everything looks like math while you're writing math. No complicated-looking, convoluded LaTeX code. 
    - Create math block with `;`
    - Exit math block with `;` or arrow keys
    - Math blocks powered by MathQuill, with special additional features:
        - This [pdf](https://fourferries.com/wp-content/uploads/2016/10/Mathquill_commands.pdf) contains a helpful list of most base MathQuill commands, but in general, any common LaTeX math command will work fine.
        - Align environment (\align), matrices (\matrix, \bmatrix, \pmatrix, etc), and cases (\cases)
        - Custom commands and shorthand
            - Designed for people who think in English. For instance, \real is shorthand for \mathbb{R}, \complex for \mathbb{C}, \a for \alpha, etc. (Note that the original commands also exist but you're a nerd if you use them.)
        - Figures (\figure) and tables (\table)
            - With added support for hiding borders and multirow/column (see later)
        - Bold (\fnt or \vec) and italicized bold (\vecf) math
    - Copy/paste works anywhere, and serialized text is valid LaTeX.
    - Undo (`ctrl+z`) and redo (`ctrl+y`) also works.
    - Virtual scrolling for smooth experience.
    - Helpful top menu to perform all features (outside of MathQuill commands)
- Direct export to OverLeaf with `Ctrl+Shift+o`
    - or copy pure LaTeX code to clipboard with `Ctrl+Shift+L`. 
- Local filesave (*no* servers are involved, purposefully)
    - `Ctrl+o` to open
    - `Ctrl+s` to save
- [SymPy](https://github.com/sympy/sympy) CAS, which runs *completely* locally via [PyScript](https://github.com/pyscript/pyscript)
    - Execute current MathQuill block with `Ctrl+Shift+=`
    - Save variables using \gets
    - Reference variables using \var
- Support for common marks, either with keybinds or latex commands:
    - \textbf (bold)
    - \textit (italics)
    - \texttt (verbatim/code)
- Support for LaTeX document organization:
    - \section
    - \subsection
- Support for labeling and referencing, with links between:
    - \label
    - \eqref
    - \cite
- Support for styled theorems, lemma, etc:
    - \theorem
    - \lemma
    - \remark
    - \corollary
    - \proposition
    - \definition
    - \qed
- Support for stylized code blocks via [CodeMirror6](https://github.com/codemirror)
    - \python
    - \java
    - \javascript
- Support for **align** environment:
    - \align
    - `Shift+DownArrow` to create a new row.
    - `&` key environment aligns operators.
- Suppose for matrices (and cases):
    - \matrix
    - \pmatrix
    - \bmatrix
    - \cases
    - \etc...
    - `Shift+DownArrow` to create a new row.
    - `Shift+RightArrow` to create a new column.
- Support for flexible **table**s:
    - \table
    - multicolumn (`Ctrl+RightArrow`)
    - multirow (`Ctrl+DownArrow`)
    - `Shift+DownArrow` to create a new row
    - `Shift+RightArrow` to create a new column
    - hide right border (`\norightborder` or `\nrb`)
    - hide bottom border (`\nobottomborder` or `\nbb`)
- Support for flexible **figure**s:
    - \figure
    - multicolumn (`Ctrl+RightArrow`)
    - `Shift+DownArrow` to create a new row.
    - `Shift+RightArrow` to create a new column.
    - Paste images directly into figures! (Images save locally in byte form in file)
    - Caption text placed under images automatically
- Math screenshots
    - `Ctrl+Shift+P` to download and copy screenshot of mathblock to keyboard.
    - Easy sharing of math. 
- Dark mode
    - Because its a required feature for any and all private projects