from sympy import simplify
from latex2sympy2_extended import latex2sympy
from sympy.printing.latex import latex

import js

def sympify(latex_string):
    # Convert latex_string to sympy, then "doit" and execute.
    # Return as latex code of result
    val = simplify(latex2sympy(latex_string).doit())
    return str(latex(val))

js.sympify = sympify