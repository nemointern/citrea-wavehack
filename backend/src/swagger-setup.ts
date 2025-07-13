import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";

/**
 * Setup Swagger documentation for the API
 * Call this function after installing swagger dependencies
 */
export function setupSwagger(app: Express) {
  const swaggerUiOptions = {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Citrea Dark Pool API",
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  // Type assertion to resolve Express type conflicts
  const expressApp = app as any;

  // Serve swagger UI
  expressApp.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  // Serve swagger JSON
  expressApp.get("/api/swagger.json", (req: any, res: any) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("📋 Swagger documentation available at /api-docs");
}
