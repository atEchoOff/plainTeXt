from sympy import simplify, parse_expr
from latex2sympy2_extended import latex2sympy
from sympy.printing.latex import latex

import js

variables = dict() # Store variables set in current context

def from_variable_format(st):
    # Replace variable format to parsable variables in sympy
    for variable in variables:
        st = st.replace(f"\\\\var{{{variable}}}", f"({variables[variable]})")

    return st

def sympify(latex_string):
    # Convert latex_string to sympy, then parse expr with evaluation set to true, doit, and simplify!
    # Return as latex code of result

    latex_string = from_variable_format(latex_string)
    
    variable = ""
    if ":=" in latex_string:
        # We are setting a variable value
        # Cut off the assignment, and we will assign after.
        variable, latex_string = latex_string.split(":=")

    sympy_form = str(latex2sympy(latex_string))
    val = simplify(parse_expr(sympy_form, evaluate=True).doit())

    str_latex = str(latex(val))

    if variable != "":
        # We should save this variable
        variables[variable] = str_latex

    return str_latex

js.sympify = sympify