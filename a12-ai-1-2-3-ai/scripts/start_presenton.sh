#!/usr/bin/env bash
# 启动 Presenton（AI PPT 引擎）。
# 启动后 TeachNova 的 PPT 编排会自动优先使用 Presenton：
#   auto → presenton(5001) → pptxgenjs(本地) → svg_master
# 若 5001 不可达，则自动降级到本地 PptxGenJS 引擎（功能不受影响）。
set -euo pipefail
PRESENTON_DIR="${PRESENTON_DIR:-$HOME/Downloads/presenton-main}"
cd "$PRESENTON_DIR"
docker compose -f docker-compose.local.yml up -d --build
echo "Presenton 启动中，访问 http://127.0.0.1:5001"
