const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    const containerName = "dog-photos";

    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
        if (!connectionString) {
            context.log.warn("Storage connection string missing. Returning empty image list.");
            context.res = {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: []
            };
            return;
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);

        const images = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            const blobClient = containerClient.getBlobClient(blob.name);
            images.push(blobClient.url);
        }

        context.res = {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: images
        };
    } catch (error) {
        context.log.error("Error loading images:", error && error.message);
        context.res = {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: []
        };
    }
};
