---
published: true # Optional. Set to true to publish the workshop (default: false)
type: workshop # Required.
title: Streamline operations and developer onboarding with AKS Automatic # Required. Full title of the workshop
short_title: Operating AKS Automatic # Optional. Short title displayed in the header
description: Are you looking for ways to automate many administrative tasks in Kubernetes and make it easier for development teams to deploy their apps while maintaining security and compliance? Azure Kubernetes Service (AKS) Automatic is a new mode of operation for AKS that simplifies cluster management, reduces manual tasks, and builds in enterprise-grade best practices and policy enforcement. This session is perfect for platform operators and DevOps engineers looking to get started with AKS Automatic. # Required.
level: beginner # Required. Can be 'beginner', 'intermediate' or 'advanced'
authors: # Required. You can add as many authors as needed
  - "Paul Yu"
contacts: # Required. Must match the number of authors
  - "@pauldotyu"
duration_minutes: 75 # Required. Estimated duration in minutes
tags: kubernetes, azure, aks # Required. Tags for filtering and searching
wt_id: WT.mc_id=containers-153036-pauyu
---

## Overview

This lab is meant to be a hands-on experience for platform operators and DevOps engineers looking to get started with AKS Automatic. You will learn how to automate many administrative tasks in Kubernetes and make it easier for development teams to deploy their apps while maintaining security and compliance. AKS Automatic is a new mode of operation for Azure Kubernetes Service (AKS) that simplifies cluster management, reduces manual tasks, and builds in enterprise-grade best practices and policy enforcement.

### Objectives

-

### Prerequisites

The lab environment has been pre-configured for you with an AKS Automatic cluster pre-provisioned with monitoring and logging enabled.

You will need the Azure CLI installed on your local machine. You can install it from [here](https://docs.microsoft.com/cli/azure/install-azure-cli).

With the Azure CLI installed, you will need to install the **aks-preview** extension to leverage preview features in AKS.

Open a terminal and install the AKS preview extension with the following command:

```bash
az extension add --name aks-preview
```

===

## Security

Security above all else. This section aims to get you comfortable with managing user access to the Kubernetes API, implementing container security, and practice managing upgrades within the cluster, both node OS images and Kubernetes version upgrades.

### Granting permissions to the AKS cluster

The first thing you need to do is grant the necessary permissions to the AKS cluster. AKS Automatic clusters are Azure RBAC enabled, which means you can assign roles to users, groups, and service principals to manage access to the cluster. When users try to execute kubectl commands against the cluster, they will be instructed to log in with their Microsoft Entra ID credentials for authentication and their assigned roles will determine what they can do within the cluster.

To grant permissions to the AKS cluster, you will need to assign a role. The following built-in roles for Azure-RBAC enabled clusters are available to assign to users.

- [Azure Kubernetes Service RBAC Admin](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-admin)
- [Azure Kubernetes Service RBAC Cluster Admin](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-cluster-admin)
- [Azure Kubernetes Service RBAC Reader](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-reader)
- [Azure Kubernetes Service RBAC Writer](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles/containers#azure-kubernetes-service-rbac-writer)

Using Azure Cloud Shell, run the following command to get the AKS cluster credentials

```bash
az aks get-credentials --resource-group myResourceGroup --name myAKSCluster
```

Create a namespace for the developer to use.

```bash
kubectl create namespace blue
```

Since this is the first time you are running a kubectl command, you will be prompted to log in against Microsoft Entra ID. After you have logged in, the command to create the namespace should be successful.

> The kubelogin plugin is used to authenticate with Microsoft Entra ID and can be easily installed with the following command.

```bash
az aks install-cli
```

Run the following command to get the AKS cluster ID and the developer user principal ID

```bash
AKS_ID=$(az aks show --resource-group myResourceGroup --name myAKSCluster --query id --output tsv)
DEV_USER_PRINCIPAL_ID=$(az ad user show --id @lab.CloudPortalCredential(User2).Username --query id --output tsv)
```

Run the following command to assign the **Azure Kubernetes Service RBAC Writer** role to a developer scoped to the **blue** namespace.

```bash
az role assignment create --role "Azure Kubernetes Service RBAC Writer" --assignee $DEV_USER_PRINCIPAL_ID --scope $AKS_ID/namespaces/blue
```

The kubelogin plugin stores the OIDC token in the `~/.kube/cache/kubelogin` directory. In order to test the permissions with a different user, you will need to delete the cached credentials.

Instead of deleting the credentials altogether, we can simply move it to a different directory. Run the following command to move the cached credentials to the parent directory.

```bash
mv ~/.kube/cache/kubelogin/*.json ..
```

> https://github.com/int128/kubelogin/issues/29

Run a kukbectl command to trigger a new login

```bash
kubectl get namespace blue
```

Since the cached credentials have been moved, you will be prompted to log in again. This time, login using the User2 credentials. After logging in, you should see the blue namespace. Now let's see if we can create a pod in the blue namespace.

```bash
kubectl auth can-i create pods --namespace blue
```

To confirm the developer cannot create pods in the default namespace, run the following command

```bash
kubectl auth can-i create pods --namespace default
```

After testing the permissions, delete the developer user's cached credentials, then move the admin's cached credentials back to the `~/.kube/cache/kubelogin` directory.

```bash
rm ~/.kube/cache/kubelogin/*.json
mv ../*.json ~/.kube/cache/kubelogin/
```
