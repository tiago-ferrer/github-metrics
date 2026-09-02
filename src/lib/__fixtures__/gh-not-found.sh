#!/bin/sh
# Simula a mensagem real do gh quando a organizacao/repositorio informado nao existe.
echo "gh: Could not resolve to an Organization with the login of 'org-inexistente'." >&2
exit 1
