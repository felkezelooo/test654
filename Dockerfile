FROM apify/actor-node-playwright:18

# Copy only package.json first to leverage Docker cache for this step
COPY package.json ./

# Optional: If you have a package-lock.json specific to this actor AND you trust it, copy it too.
# COPY package-lock.json ./

# Ensure a clean state for npm install
# - Remove package-lock.json if it was copied or exists from a previous layer to force fresh resolution from package.json.
# - Clean npm cache.
# - Remove node_modules to ensure no old/conflicting packages interfere.
RUN rm -f package-lock.json \
 && npm cache clean --force --quiet \
 && rm -rf node_modules \
 && npm --quiet set progress=false \
 && echo "Running npm install for production dependencies without optional ones..." \
 && npm install --only=prod --no-optional \
 && echo "Installed NPM packages (production, no optional, depth 0):" \
 && (npm list --depth=0 --omit=dev --omit=optional || true) \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version

# Copy the rest of the actor's source code
COPY . ./

# Set the command to run when the container starts
CMD ["node", "main.js"]
