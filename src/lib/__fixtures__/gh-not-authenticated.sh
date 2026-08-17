#!/bin/sh
# Simula a saida real do gh quando o usuario nunca rodou `gh auth login`.
echo "You are not logged into any GitHub hosts. Run gh auth login to authenticate." >&2
exit 1
