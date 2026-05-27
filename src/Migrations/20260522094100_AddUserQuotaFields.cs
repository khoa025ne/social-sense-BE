using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SocialSense.Migrations
{
    /// <inheritdoc />
    public partial class AddUserQuotaFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DailyQuotaLimit",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 10);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastQuotaReset",
                table: "Users",
                type: "datetime(6)",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP(6)");

            migrationBuilder.AddColumn<int>(
                name: "RemainingQuota",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 10);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DailyQuotaLimit",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastQuotaReset",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RemainingQuota",
                table: "Users");
        }
    }
}
