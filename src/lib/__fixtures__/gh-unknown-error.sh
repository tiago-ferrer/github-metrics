#!/bin/sh
# Falha generica, sem nenhum dos padroes conhecidos -> deve cair em "unknown".
echo "something unexpected happened" >&2
exit 1
