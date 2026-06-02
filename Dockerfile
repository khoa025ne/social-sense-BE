# ── Stage 1: Build ──────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/SocialSense.csproj", "src/"]
RUN dotnet restore "src/SocialSense.csproj"

COPY src/ src/
WORKDIR "/src/src"
RUN dotnet publish "SocialSense.csproj" -c Release -o /app/publish /p:UseAppHost=false

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_HTTP_PORTS=8080

ENTRYPOINT ["dotnet", "SocialSense.dll"]
