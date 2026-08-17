#!/bin/sh
# Simula falha de rede/DNS ao tentar falar com api.github.com.
echo "error connecting to api.github.com" >&2
echo "dial tcp: lookup api.github.com: could not resolve host" >&2
exit 1
