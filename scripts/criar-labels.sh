#!/usr/bin/env bash
# Uso: ./scripts/criar-labels.sh dono/repo   (precisa do gh logado)
R=$1
for l in "os:c2410c" "aguardando-analise:fbca04" "em-manutencao:1d76db" "aguardando-pecas:d93f0b" "manutencao-externa:5319e7" "liberado-para-uso:0e8a16" "perda-total:b60205" "sem-foto:000000"; do
  gh label create "${l%%:*}" --color "${l##*:}" -R "$R" --force
done
