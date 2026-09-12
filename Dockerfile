# ---- build ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore as its own layer so a code-only change does not re-download packages.
COPY src/BalSanskar.Web/BalSanskar.Web.csproj src/BalSanskar.Web/
RUN dotnet restore src/BalSanskar.Web/BalSanskar.Web.csproj

COPY . .
RUN dotnet publish src/BalSanskar.Web/BalSanskar.Web.csproj \
    -c Release -o /app --no-restore

# ---- run ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

# The SQLite file lives on a mounted volume so it survives redeploys.
ENV Database__Path=/data/balsanskar.db
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Runs as root on purpose. Fly mounts volumes root-owned, so a non-root
# process cannot write to /data, and the usual fix (an entrypoint that chowns
# then drops privileges with gosu/su-exec) adds a moving part that is not
# present in this base image. Each Fly app already runs in its own Firecracker
# microVM, so container-root is not host-root. If this is ever moved onto
# shared container infrastructure, revisit: add a privilege-dropping
# entrypoint and set USER there.

ENTRYPOINT ["dotnet", "BalSanskar.Web.dll"]
