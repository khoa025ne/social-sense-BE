# ── Stage 1: Build ──────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj và restore dependencies trước (cache layer)
COPY ["src/SocialSense.csproj", "src/"]
RUN dotnet restore "src/SocialSense.csproj"

# Copy toàn bộ source
COPY src/ src/

# Build release
WORKDIR "/src/src"
RUN dotnet publish "SocialSense.csproj" -c Release -o /app/publish /p:UseAppHost=false

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Copy published output
COPY --from=build /app/publish .

# Render inject PORT qua env var, ASP.NET Core đọc ASPNETCORE_URLS
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "SocialSense.dll"]
