import * as z from 'zod';
import type { Core, Modules } from '@strapi/types';
import { makeMcpToolDefinition } from '../tool-registry';

interface ContentTypeToolGeneratorParams {
  strapi: Core.Strapi;
}

export const generateContentTypeTools = ({
  strapi,
}: ContentTypeToolGeneratorParams): Modules.MCP.McpToolDefinition[] => {
  const tools: Modules.MCP.McpToolDefinition[] = [];
  const contentTypes = strapi.contentTypes;

  // Guard against undefined/null contentTypes
  if (contentTypes === undefined || contentTypes === null) {
    return tools;
  }

  // Get displayable content types (exclude admin, plugin internals)
  const displayedContentTypes = Object.entries(contentTypes).filter(([uid, ct]) => {
    // Filter logic similar to content-manager's findDisplayedContentTypes
    if (ct === null || ct === undefined) {
      return false;
    }
    if (uid.startsWith('admin::')) {
      return false;
    }
    if (uid.startsWith('strapi::')) {
      return false;
    }
    if (ct.kind === 'collectionType' || ct.kind === 'singleType') {
      return ct.visible !== false;
    }
    return false;
  });

  for (const [uid, contentType] of displayedContentTypes) {
    const modelName = uid.split('.').pop(); // 'api::article.article' -> 'article'
    const pluralName = contentType.info.pluralName || `${modelName}s`;
    const singularName = contentType.info.singularName || modelName;

    // Generate READ tools (find/findOne)
    if (contentType.kind === 'collectionType') {
      const listTool = makeMcpToolDefinition({
        name: `list_${pluralName}`,
        title: `List ${contentType.info.displayName || pluralName}`,
        description: `Retrieve a list of ${pluralName} with filtering and pagination`,
        inputSchema: z.object({
          filters: z.record(z.any()).optional(),
          sort: z.string().optional(),
          page: z.number().optional(),
          pageSize: z.number().optional(),
        }),
        outputSchema: z.object({
          data: z.array(z.record(z.any())),
          meta: z.object({
            pagination: z.object({
              page: z.number(),
              pageSize: z.number(),
              pageCount: z.number(),
              total: z.number(),
            }),
          }),
        }),
        auth: {
          actions: ['plugin::content-manager.explorer.read'],
          subject: uid,
        },
        createHandler: (strapi) => async (params) => {
          const documentService = strapi.documents(uid as any);

          const [documents, total] = await Promise.all([
            documentService.findMany({
              filters: params.filters,
              sort: params.sort,
              page: params.page,
              pageSize: params.pageSize,
            }),
            documentService.count({
              filters: params.filters,
            }),
          ]);

          const page = params.page || 1;
          const pageSize = params.pageSize || 25;
          const pageCount = Math.ceil((total as number) / pageSize);

          const result = {
            data: documents as Record<string, any>[],
            meta: {
              pagination: {
                page,
                pageSize,
                pageCount,
                total: total as number,
              },
            },
          };

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        },
      });
      tools.push(listTool);

      const getTool = makeMcpToolDefinition({
        name: `get_${singularName}`,
        title: `Get ${contentType.info.displayName || singularName}`,
        description: `Retrieve a single ${singularName} by document ID`,
        inputSchema: z.object({
          documentId: z.union([z.string(), z.number()]),
        }),
        outputSchema: z.object({
          data: z.record(z.any()),
        }),
        auth: {
          actions: ['plugin::content-manager.explorer.read'],
          subject: uid,
        },
        createHandler: (strapi) => async (params) => {
          const documentService = strapi.documents(uid as any);
          const document = await documentService.findOne({
            documentId: String(params.documentId),
          });

          const result = { data: document as Record<string, any> };

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        },
      });
      tools.push(
        // @ts-expect-error - inputSchema collision
        getTool
      );
    } else {
      // Single type - just get
      tools.push(
        makeMcpToolDefinition({
          name: `get_${singularName}`,
          title: `Get ${contentType.info.displayName || singularName}`,
          description: `Retrieve the ${singularName} content`,
          outputSchema: z.object({
            data: z.record(z.any()),
          }),
          auth: {
            actions: ['plugin::content-manager.explorer.read'],
            subject: uid,
          },
          createHandler: (strapi) => async () => {
            const documentService = strapi.documents(uid as any);
            const document = await documentService.findFirst();

            const result = { data: document as Record<string, any> };

            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
              structuredContent: result,
            };
          },
        })
      );
    }

    // Generate CREATE tool
    if (contentType.kind === 'collectionType') {
      const createTool = makeMcpToolDefinition({
        name: `create_${singularName}`,
        title: `Create ${contentType.info.displayName || singularName}`,
        description: `Create a new ${singularName}`,
        inputSchema: z.object({
          data: z.record(z.any()),
        }),
        outputSchema: z.object({
          data: z.record(z.any()),
        }),
        auth: {
          actions: ['plugin::content-manager.explorer.create'],
          subject: uid,
        },
        createHandler: (strapi) => async (params) => {
          const documentService = strapi.documents(uid as any);
          const document = await documentService.create({ data: params.data });

          const result = { data: document as Record<string, any> };

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        },
      });
      tools.push(
        // @ts-expect-error - inputSchema collision
        createTool
      );
    }

    // Generate UPDATE tool
    const updateTool = makeMcpToolDefinition({
      name: `update_${singularName}`,
      title: `Update ${contentType.info.displayName || singularName}`,
      description: `Update an existing ${singularName} by document ID`,
      inputSchema: z.object({
        documentId: z.union([z.string(), z.number()]),
        data: z.record(z.any()),
      }),
      outputSchema: z.object({
        data: z.record(z.any()),
      }),
      auth: {
        actions: ['plugin::content-manager.explorer.update'],
        subject: uid,
      },
      createHandler: (strapi) => async (params) => {
        const documentService = strapi.documents(uid as any);
        const document = await documentService.update({
          documentId: String(params.documentId),
          data: params.data,
        });

        const result = { data: document as Record<string, any> };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      },
    });
    tools.push(
      // @ts-expect-error - inputSchema collision
      updateTool
    );

    // Generate DELETE tool
    if (contentType.kind === 'collectionType') {
      const deleteTool = makeMcpToolDefinition({
        name: `delete_${singularName}`,
        title: `Delete ${contentType.info.displayName || singularName}`,
        description: `Delete a ${singularName} by document ID`,
        inputSchema: z.object({
          documentId: z.union([z.string(), z.number()]),
        }),
        outputSchema: z.object({
          data: z.record(z.any()),
        }),
        auth: {
          actions: ['plugin::content-manager.explorer.delete'],
          subject: uid,
        },
        createHandler: (strapi) => async (params) => {
          const documentService = strapi.documents(uid as any);
          const document = await documentService.delete({
            documentId: String(params.documentId),
          });

          const result = { data: document as Record<string, any> };

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        },
      });
      tools.push(
        // @ts-expect-error - inputSchema collision
        deleteTool
      );
    }
  }

  return tools;
};
