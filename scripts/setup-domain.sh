#!/usr/bin/env bash
# Puts this Pawpost installation on your domain with HTTPS (Caddy + Let's Encrypt).
#
#   bash scripts/setup-domain.sh app.example.com
#
# Checks that the domain points to this server, updates .env (DOMAIN, APP_URL,
# COMPOSE_PROFILES, WEB_BIND_ADDRESS; a backup is kept), starts Caddy and waits
# until https://<domain> answers. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/.."

bold=$'\033[1m' red=$'\033[31m' green=$'\033[32m' yellow=$'\033[33m' reset=$'\033[0m'
step() { printf '\n%s▶ %s%s\n' "$bold" "$*" "$reset"; }
ok() { printf '  %s✔%s %s\n' "$green" "$reset" "$*"; }
warn() { printf '  %s!%s %s\n' "$yellow" "$reset" "$*"; }
fail() {
  printf '\n%s✘ %s%s\n' "$red" "$1" "$reset" >&2
  [[ $# -gt 1 ]] && printf '%s\n' "${@:2}" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: bash scripts/setup-domain.sh <domain> [--skip-dns-check]

  <domain>           The address for Pawpost, e.g. app.example.com. Create a DNS
                     "A" record pointing it to this server first.
  --skip-dns-check   Don't check where the domain points (for unusual DNS setups).
EOF
}

domain="" skip_dns=0
for arg in "$@"; do
  case "$arg" in
    --skip-dns-check) skip_dns=1 ;;
    -h | --help) usage && exit 0 ;;
    -*) fail "Unknown option: $arg" ;;
    *)
      [[ -z "$domain" ]] || fail "Give one domain only."
      domain="$arg"
      ;;
  esac
done
[[ -n "$domain" ]] || { usage && exit 1; }

domain="${domain,,}"
domain="${domain#http://}" && domain="${domain#https://}" && domain="${domain%%/*}"
[[ "$domain" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] ||
  fail "\"$domain\" doesn't look like a domain name, e.g. app.example.com."

[[ -f .env ]] || fail "No .env file here." "Copy .env.example to .env and fill it in first (see the README)."
command -v docker >/dev/null || fail "Docker isn't installed."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is needed (the \"docker compose\" command)."
command -v curl >/dev/null || fail "curl is needed: apt install curl"

# --- DNS -------------------------------------------------------------------

# Public DNS (what Let's Encrypt sees), not this server's possibly cached resolver.
dns_lookup() {
  curl -fsS --max-time 10 "https://dns.google/resolve?name=$domain&type=$1" 2>/dev/null |
    grep -o '"data":"[^"]*"' | cut -d'"' -f4 || true
}

step "Checking that $domain points to this server"
server_ip="$(curl -fsS4 --max-time 10 https://api.ipify.org 2>/dev/null || curl -fsS4 --max-time 10 https://ifconfig.me 2>/dev/null || true)"

if [[ $skip_dns -eq 1 ]]; then
  warn "Skipped (--skip-dns-check)."
else
  [[ -n "$server_ip" ]] || fail "Couldn't find this server's public IP address." \
    "Check the server can reach the internet, or run again with --skip-dns-check."
  a_records="$(dns_lookup A | grep -E '^[0-9]+(\.[0-9]+){3}$' || true)"
  record_help="  Create this record at your domain's DNS provider, then run this again:

    Type:   A
    Name:   ${domain}   (many providers want only the part before your main domain, e.g. \"app\")
    Value:  ${server_ip}

  New records usually appear within minutes, sometimes up to an hour.
  If you use Cloudflare, set the record to \"DNS only\" (grey cloud)."
  if [[ -z "$a_records" ]]; then
    fail "$domain has no A record yet." "$record_help"
  elif ! grep -qxF "$server_ip" <<<"$a_records"; then
    fail "$domain points to $(paste -sd, <<<"$a_records"), but this server is $server_ip." "$record_help"
  fi
  ok "$domain → $server_ip"

  aaaa_records="$(dns_lookup AAAA | grep ':' || true)"
  if [[ -n "$aaaa_records" ]]; then
    server_ip6="$(curl -fsS6 --max-time 10 https://api64.ipify.org 2>/dev/null || true)"
    if [[ -z "$server_ip6" ]] || ! grep -qxF "$server_ip6" <<<"$aaaa_records"; then
      warn "$domain also has an IPv6 (AAAA) record that isn't this server: $(paste -sd, <<<"$aaaa_records")"
      warn "Let's Encrypt may use it and fail. Delete that record unless it's correct."
    fi
  fi
fi

# --- Ports and firewall --------------------------------------------------------

step "Checking ports 80 and 443"
caddy_running="$(docker compose ps --status running -q caddy 2>/dev/null || true)"
if [[ -z "$caddy_running" ]] && command -v ss >/dev/null; then
  listeners="$(ss -Htlnp '( sport = :80 or sport = :443 )' 2>/dev/null || true)"
  [[ -z "$listeners" ]] || fail "Something else is already using port 80 or 443:" "$listeners" \
    "Stop it first (often nginx or Apache: systemctl disable --now nginx apache2)."
fi
ok "Ports 80 and 443 are free for Caddy."

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  rules="$(ufw status)"
  if ! grep -qE '^80(/tcp)?[[:space:]]+ALLOW' <<<"$rules" || ! grep -qE '^443(/tcp)?[[:space:]]+ALLOW' <<<"$rules"; then
    warn "The ufw firewall is on and may block HTTPS. Allow it with:"
    warn "  ufw allow 80/tcp && ufw allow 443"
  fi
fi

# --- .env ------------------------------------------------------------------

step "Updating .env"
backup=".env.backup-$(date +%Y%m%d-%H%M%S)"
cp .env "$backup"
[[ -z "$(tail -c1 .env)" ]] || echo >>.env

set_env() {
  if grep -qE "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    printf '%s=%s\n' "$1" "$2" >>.env
  fi
  ok "$1=$2"
}

profiles="$(grep -E '^COMPOSE_PROFILES=' .env | tail -n1 | cut -d= -f2- | tr -d '\r' || true)"
case ",$profiles," in
  *,https,*) ;;
  ,,) profiles="https" ;;
  *) profiles="$profiles,https" ;;
esac

set_env DOMAIN "$domain"
set_env APP_URL "https://$domain"
set_env COMPOSE_PROFILES "$profiles"
set_env WEB_BIND_ADDRESS "127.0.0.1"
ok "Previous settings saved in $backup"

# --- Start -----------------------------------------------------------------

step "Starting Pawpost with HTTPS (the first build can take a few minutes)"
docker compose up -d --build

step "Waiting for https://$domain (Caddy is getting a certificate)"
for _ in $(seq 1 36); do
  if curl -fsS --max-time 10 "https://$domain/api/health" >/dev/null 2>&1; then
    ok "Pawpost is live at https://$domain"
    cat <<EOF

  Next:
  - Sign in at https://$domain (sign in again; the old address no longer works from outside).
  - Unsubscribe links in new emails now use https://$domain.
  - Certificates renew automatically. Keep ports 80 and 443 open.
EOF
    exit 0
  fi
  sleep 5
done

docker compose logs --tail 40 caddy >&2 || true
fail "https://$domain didn't answer within 3 minutes." \
  "Common causes:" \
  "  - The DNS record is new and not visible everywhere yet: wait a few minutes and run this again." \
  "  - A firewall (your host's panel or ufw) blocks ports 80/443 from the internet." \
  "  - Too many certificate attempts: Let's Encrypt allows 5 failures per hour." \
  "Caddy's log is above. To go back to the previous settings: cp $backup .env && docker compose up -d"
