#!/usr/bin/env bash
# Hook PreToolUse de Claude Code: bloquea `git push` hacia main/master.
# Exit 2 = bloquear y devolver el mensaje de stderr a Claude.
command=$(jq -r '.tool_input.command // ""')
branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null)

block() {
  echo "Push a main bloqueado: en este repo todo cambio va por PR. Crea una rama (git switch -c ...), haz push de esa rama y abre el PR con gh pr create." >&2
  exit 2
}

# Se revisa cada tramo del comando por separado (separado por ; & | o saltos de línea),
# y solo los que *empiezan* por `git ... push`. Así un mensaje de commit que mencione
# "push a main" no dispara el bloqueo.
while IFS= read -r segment; do
  [[ "$segment" =~ ^[[:space:]]*(sudo[[:space:]]+)?git[[:space:]]+([^[:space:]]+[[:space:]]+)*push([[:space:]]|$) ]] || continue

  [[ "$segment" =~ (^|[[:space:]:/])(main|master)([[:space:]]|$) ]] && block
  [[ "$segment" =~ --(all|mirror)([[:space:]]|$) ]] && block
  # Sin rama explícita, el push va a la rama actual.
  [[ "$branch" == "main" || "$branch" == "master" ]] && block
done < <(tr ';&|' '\n' <<<"$command")

exit 0
